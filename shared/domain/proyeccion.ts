import { CERO, Decimal, dec, type MontoInput } from "./dinero.js";
import { mesDe, partesMes, rangoMeses, sumarMeses } from "./fechas.js";
import { fechaImpacto } from "./impacto.js";
import { fechaOcurrencia, ocurreEn, type RecurrenciaCalendario } from "./recurrencias.js";
import { HOGAR, type CuentaImpacto, type Mes, type MovimientoCalc, type Vista } from "./tipos.js";
import { efectoEnVista } from "./vistas.js";

export interface RecurrenciaProyeccion extends RecurrenciaCalendario {
  id: string;
  concepto: string;
  tipo: "ingreso" | "gasto";
  /** Monto estimado en moneda base. */
  monto: MontoInput;
  /** Dueño efectivo (si la recurrencia es "de quien pague", el titular de la cuenta). */
  duenoId: string;
  cuenta: CuentaImpacto;
  /**
   * Gasto variable (súper, nafta…): se carga compra por compra, no genera pendientes.
   * Lo ya gastado en su categoría ese mes se descuenta del estimado (sin bajar de cero).
   */
  variable?: boolean;
  categoriaId?: string | null;
}

export interface EventoProyeccion {
  id: string;
  nombre: string;
  /** 1–12 */
  mes: number;
  monto: MontoInput;
  activo?: boolean;
  /** null = del hogar (solo cuenta en la vista Hogar). */
  duenoId?: string | null;
}

export type Alerta = "ok" | "ambar" | "rojo";
export type Rubro = "ingreso" | "fijo" | "cuota" | "evento" | "variable" | "transferencia";
export type Origen = "real" | "pendiente" | "estimado";

export interface LineaProyeccion {
  rubro: Rubro;
  origen: Origen;
  concepto: string;
  /** Positivo suma a la sobra, negativo resta. */
  monto: Decimal;
  refId: string;
}

export interface MesProyeccion {
  mes: Mes;
  ingresos: Decimal;
  fijos: Decimal;
  cuotas: Decimal;
  eventos: Decimal;
  variables: Decimal;
  /** Neto de transferencias (solo vistas de persona): recibidas − enviadas. */
  transferencias: Decimal;
  sobra: Decimal;
  acumulado: Decimal;
  alerta: Alerta;
  lineas: LineaProyeccion[];
}

export interface EntradaProyeccion {
  desde: Mes;
  meses: number;
  vista: Vista;
  /** Por debajo de este margen, el mes se marca en ámbar (debajo de cero, en rojo). */
  umbral: MontoInput;
  recurrencias: RecurrenciaProyeccion[];
  /** Movimientos ya cargados o materializados (confirmados, pendientes, cuotas futuras, omitidos). */
  movimientos: MovimientoCalc[];
  eventos: EventoProyeccion[];
}

/**
 * Proyección de flujo: para cada mes, lo que ya está cargado (real, pendiente o cuotas) más lo que
 * se espera de las recurrencias que todavía no se materializaron y de los eventos presupuestados.
 *
 * - Todo se ubica por fecha de impacto: un gasto con tarjeta de octubre cae en noviembre.
 * - Una recurrencia no se cuenta dos veces: si ya hay un movimiento para ese período
 *   (aunque esté omitido), manda el movimiento.
 * - Las transferencias nunca son gasto (ver `efectoEnVista`).
 * - Una recurrencia variable estima solo lo que falta gastar: estimado − lo cargado en su
 *   categoría ese mes (los gastos sueltos, no los de otras recurrencias ni cuotas).
 */
export function proyectar(e: EntradaProyeccion): MesProyeccion[] {
  const meses = rangoMeses(e.desde, e.meses);
  const umbral = dec(e.umbral);

  const materializados = new Set<string>();
  for (const m of e.movimientos) {
    if (m.recurrenciaId && m.periodo) materializados.add(`${m.recurrenciaId}|${m.periodo}`);
  }

  let acumulado = CERO;
  return meses.map((mes) => {
    const lineas: LineaProyeccion[] = [];

    // Gastos sueltos del mes por categoría: el "pozo" que consumen las recurrencias variables.
    const sueltos = new Map<string, Decimal>();

    for (const m of e.movimientos) {
      if (mesDe(m.fechaImpacto) !== mes) continue;
      const efecto = efectoEnVista(m, e.vista);
      if (!efecto) continue;
      const origen: Origen = m.estado === "pendiente" ? "pendiente" : "real";
      const concepto = m.concepto ?? "";
      if (efecto === "ingreso") lineas.push({ rubro: "ingreso", origen, concepto, monto: m.monto, refId: m.id });
      else if (efecto === "recibida") lineas.push({ rubro: "transferencia", origen, concepto, monto: m.monto, refId: m.id });
      else if (efecto === "enviada") lineas.push({ rubro: "transferencia", origen, concepto, monto: m.monto.negated(), refId: m.id });
      else {
        const rubro: Rubro = m.planCuotasId ? "cuota" : m.recurrenciaId ? "fijo" : "variable";
        lineas.push({ rubro, origen, concepto, monto: m.monto.negated(), refId: m.id });
        if (rubro === "variable" && m.categoriaId) sueltos.set(m.categoriaId, (sueltos.get(m.categoriaId) ?? CERO).plus(m.monto));
      }
    }

    for (const rec of e.recurrencias) {
      if (e.vista !== HOGAR && rec.duenoId !== e.vista) continue;
      // Un consumo con tarjeta puede impactar hasta dos meses después.
      for (const consumo of [sumarMeses(mes, -2), sumarMeses(mes, -1), mes]) {
        if (!ocurreEn(rec, consumo)) continue;
        if (mesDe(fechaImpacto(fechaOcurrencia(rec, consumo), rec.cuenta)) !== mes) continue;
        if (materializados.has(`${rec.id}|${consumo}`)) continue;
        let monto = dec(rec.monto);
        if (rec.variable && rec.tipo === "gasto" && rec.categoriaId) {
          const gastado = sueltos.get(rec.categoriaId) ?? CERO;
          const usado = Decimal.min(gastado, monto);
          sueltos.set(rec.categoriaId, gastado.minus(usado));
          monto = monto.minus(usado);
          if (monto.isZero()) continue;
        }
        lineas.push({
          rubro: rec.tipo === "ingreso" ? "ingreso" : "fijo",
          origen: "estimado",
          concepto: rec.concepto,
          monto: rec.tipo === "ingreso" ? monto : monto.negated(),
          refId: rec.id,
        });
      }
    }

    const numeroMes = partesMes(mes)[1];
    for (const ev of e.eventos) {
      if (ev.activo === false || ev.mes !== numeroMes) continue;
      if (e.vista !== HOGAR && ev.duenoId !== e.vista) continue;
      lineas.push({ rubro: "evento", origen: "estimado", concepto: ev.nombre, monto: dec(ev.monto).negated(), refId: ev.id });
    }

    const total = (rubro: Rubro) => lineas.filter((l) => l.rubro === rubro).reduce((a, l) => a.plus(l.monto), CERO);
    const ingresos = total("ingreso");
    const fijos = total("fijo").negated();
    const cuotas = total("cuota").negated();
    const eventos = total("evento").negated();
    const variables = total("variable").negated();
    const transferencias = total("transferencia");
    const sobra = ingresos.minus(fijos).minus(cuotas).minus(eventos).minus(variables).plus(transferencias);
    acumulado = acumulado.plus(sobra);

    return {
      mes,
      ingresos,
      fijos,
      cuotas,
      eventos,
      variables,
      transferencias,
      sobra,
      acumulado,
      alerta: sobra.isNegative() ? "rojo" : sobra.lt(umbral) ? "ambar" : "ok",
      lineas,
    };
  });
}

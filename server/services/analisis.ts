import { aMonedaBase, dec, Decimal } from "../../shared/domain/dinero.js";
import { mesDe, sumarMeses, ultimoDia } from "../../shared/domain/fechas.js";
import { proyectar, type MesProyeccion, type RecurrenciaProyeccion } from "../../shared/domain/proyeccion.js";
import { resumenMes } from "../../shared/domain/resumen.js";
import { HOGAR, type Mes, type Vista } from "../../shared/domain/tipos.js";
import type { DashboardDTO, MesProyeccionDTO, ProyeccionDTO } from "../../shared/schemas/api.js";
import type { PrismaClient } from "../db.js";
import { aFecha, deFecha } from "../fechas.js";
import { HttpError } from "../http.js";
import type { Contexto } from "./contexto.js";
import { aCalc, incluirCalc } from "./movimientos.js";

export async function validarVista(p: PrismaClient, vista: string | undefined): Promise<Vista> {
  if (!vista || vista === HOGAR) return HOGAR;
  const persona = await p.persona.findUnique({ where: { id: vista }, select: { id: true } });
  if (!persona) throw new HttpError(400, "Vista inválida");
  return persona.id;
}

async function movimientosCalc(p: PrismaClient, ctx: Contexto, desde: Mes, hasta: Mes) {
  const movs = await p.movimiento.findMany({
    where: { fechaImpacto: { gte: deFecha(`${desde}-01`), lte: deFecha(ultimoDia(hasta)) } },
    include: incluirCalc,
  });
  return movs.map((m) => aCalc(m, ctx));
}

export async function calcularProyeccion(p: PrismaClient, ctx: Contexto, vista: Vista, meses: number, desde = mesDe(ctx.hoy)): Promise<ProyeccionDTO> {
  const hasta = sumarMeses(desde, meses - 1);
  // Los movimientos de recurrencias pueden tener período hasta 2 meses antes del impacto: se traen desde antes
  // para que la proyección sepa qué períodos ya están materializados.
  const [movimientos, recs, eventos] = await Promise.all([
    movimientosCalc(p, ctx, sumarMeses(desde, -2), hasta),
    p.recurrencia.findMany({ where: { activa: true }, include: { cuenta: true } }),
    p.evento.findMany({ where: { activo: true } }),
  ]);

  const avisos: string[] = [];
  const recurrencias: RecurrenciaProyeccion[] = [];
  for (const r of recs) {
    let monto: string;
    try {
      monto = aMonedaBase(dec(r.montoEstimado), r.moneda, ctx.base, ctx.cotizacion).toString();
    } catch {
      avisos.push(`"${r.concepto}" está en ${r.moneda} y no hay cotización cargada: no se incluye.`);
      continue;
    }
    recurrencias.push({
      id: r.id,
      concepto: r.concepto,
      tipo: r.tipo === "ingreso" ? "ingreso" : "gasto",
      monto,
      duenoId: r.duenoId ?? r.cuenta.titularId,
      cuenta: r.cuenta,
      frecuencia: r.frecuencia,
      mesAncla: r.mesAncla,
      diaDelMes: r.diaDelMes,
      desde: aFecha(r.desde),
      fechaFin: aFecha(r.fechaFin),
      activa: r.activa,
    });
  }

  const resultado = proyectar({
    desde,
    meses,
    vista,
    umbral: dec(ctx.config.umbralMargenBajo),
    recurrencias,
    movimientos,
    eventos: eventos.map((e) => ({ id: e.id, nombre: e.nombre, mes: e.mes, monto: dec(e.montoPresupuestado), activo: e.activo, duenoId: e.duenoId })),
  });

  return { vista, umbral: dec(ctx.config.umbralMargenBajo).toString(), meses: resultado.map(mesDTO), avisos };
}

function mesDTO(m: MesProyeccion): MesProyeccionDTO {
  return {
    mes: m.mes,
    ingresos: m.ingresos.toString(),
    fijos: m.fijos.toString(),
    cuotas: m.cuotas.toString(),
    eventos: m.eventos.toString(),
    variables: m.variables.toString(),
    transferencias: m.transferencias.toString(),
    sobra: m.sobra.toString(),
    acumulado: m.acumulado.toString(),
    alerta: m.alerta,
    lineas: m.lineas
      .map((l) => ({ ...l, monto: l.monto.toString() }))
      .sort((a, b) => Math.abs(Number(b.monto)) - Math.abs(Number(a.monto))),
  };
}

export async function calcularDashboard(p: PrismaClient, ctx: Contexto, vista: Vista, mes: Mes): Promise<DashboardDTO> {
  const [movs, categorias, proy] = await Promise.all([
    movimientosCalc(p, ctx, mes, mes),
    p.categoria.findMany({ select: { id: true, padreId: true } }),
    calcularProyeccion(p, ctx, vista, 3, mesDe(ctx.hoy)),
  ]);
  const padre = new Map(categorias.map((c) => [c.id, c.padreId]));
  const raiz = (id: string) => {
    let actual = id;
    for (let i = 0; i < 5; i++) {
      const pa = padre.get(actual);
      if (!pa) return actual;
      actual = pa;
    }
    return actual;
  };

  // Gasto hormiga: promedio por debajo del 1,5 % de los ingresos del mes (mínimo $ 5.000).
  const base = resumenMes(movs, { mes, vista });
  const umbralHormiga = Decimal.max(base.ingresos.times(0.015), 5000);
  const r = resumenMes(movs, { mes, vista, raiz, hormigaPromedioMaximo: umbralHormiga });

  const total = (t: (typeof r.porCategoria)[number]) => ({ ...t, total: t.total.toString() });
  return {
    mes,
    vista,
    ingresos: r.ingresos.toString(),
    gastos: r.gastos.toString(),
    enviadas: r.enviadas.toString(),
    recibidas: r.recibidas.toString(),
    ahorro: r.ahorro.toString(),
    tasaAhorro: r.tasaAhorro,
    porCategoria: r.porCategoria.map(total),
    top5: r.top5.map(total),
    hormiga: r.hormiga.map((h) => ({ ...h, total: h.total.toString(), promedio: h.promedio.toString() })),
    pendientes: { cantidad: r.pendientes.cantidad, ingresos: r.pendientes.ingresos.toString(), gastos: r.pendientes.gastos.toString() },
    proximos: proy.meses.map((m) => ({ mes: m.mes, sobra: m.sobra, alerta: m.alerta })),
  };
}

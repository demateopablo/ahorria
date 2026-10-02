/** Prisma → DTOs de la API: montos como string, fechas como "YYYY-MM-DD". */
import { aMonedaBase, dec } from "../shared/domain/dinero.js";
import { cuotaDelMes } from "../shared/domain/cuotas.js";
import { mesDe, sumarMesesFecha } from "../shared/domain/fechas.js";
import { montoMensual } from "../shared/domain/recurrencias.js";
import type { Fecha, Moneda } from "../shared/domain/tipos.js";
import type {
  CategoriaDTO,
  ConfigDTO,
  CotizacionDTO,
  CuentaDTO,
  EventoDTO,
  MovimientoDTO,
  PersonaDTO,
  PlanCuotasDTO,
  RecurrenciaDTO,
} from "../shared/schemas/api.js";
import { aFecha } from "./fechas.js";
import type {
  Categoria,
  Config,
  Cotizacion,
  Cuenta,
  Evento,
  Movimiento,
  Persona,
  PlanCuotas,
  Recurrencia,
} from "./generated/prisma/client.js";

const s = (d: { toString(): string } | null | undefined) => (d == null ? null : dec(d).toString());

export const configDTO = (c: Config): ConfigDTO => ({
  nombreHogar: c.nombreHogar,
  monedaBase: c.monedaBase,
  locale: c.locale,
  timezone: c.timezone,
  umbralMargenBajo: dec(c.umbralMargenBajo).toString(),
});

export const personaDTO = (p: Persona): PersonaDTO => ({
  id: p.id,
  nombre: p.nombre,
  email: p.email,
  color: p.color,
  orden: p.orden,
});

export const cuentaDTO = (c: Cuenta): CuentaDTO => ({
  id: c.id,
  nombre: c.nombre,
  tipo: c.tipo,
  moneda: c.moneda,
  titularId: c.titularId,
  saldoInicial: dec(c.saldoInicial).toString(),
  fechaSaldoInicial: aFecha(c.fechaSaldoInicial),
  tna: s(c.tna),
  diaCierre: c.diaCierre,
  diaVencimiento: c.diaVencimiento,
  orden: c.orden,
  archivada: c.archivada,
});

export const categoriaDTO = (c: Categoria): CategoriaDTO => ({
  id: c.id,
  nombre: c.nombre,
  tipo: c.tipo,
  padreId: c.padreId,
  icono: c.icono,
  color: c.color,
  ambitoDefault: c.ambitoDefault,
  orden: c.orden,
  archivada: c.archivada,
});

type MovimientoConRelaciones = Movimiento & {
  recurrencia?: Pick<Recurrencia, "concepto"> | null;
  planCuotas?: Pick<PlanCuotas, "descripcion" | "cantidadCuotas" | "cuotasPrevias"> | null;
};

export function conceptoMovimiento(m: MovimientoConRelaciones): string {
  if (m.planCuotas && m.numeroCuota) {
    const total = m.planCuotas.cantidadCuotas + m.planCuotas.cuotasPrevias;
    return `${m.planCuotas.descripcion} · ${m.numeroCuota + m.planCuotas.cuotasPrevias}/${total}`;
  }
  return m.nota || m.recurrencia?.concepto || "";
}

/** Monto en moneda base; si es USD sin cotización propia usa la de respaldo (o 0 si no hay ninguna). */
export function montoBaseMovimiento(m: Pick<Movimiento, "monto" | "moneda" | "cotizacion">, base: Moneda, respaldo: string | null): string {
  const cot = m.cotizacion ? dec(m.cotizacion) : respaldo;
  if (m.moneda !== base && cot == null) return "0";
  return aMonedaBase(dec(m.monto), m.moneda, base, cot).toString();
}

export const movimientoDTO = (m: MovimientoConRelaciones, base: Moneda, cotizacionRespaldo: string | null): MovimientoDTO => ({
  id: m.id,
  tipo: m.tipo,
  estado: m.estado,
  monto: dec(m.monto).toString(),
  moneda: m.moneda,
  cotizacion: s(m.cotizacion),
  montoBase: montoBaseMovimiento(m, base, cotizacionRespaldo),
  fechaConsumo: aFecha(m.fechaConsumo),
  fechaImpacto: aFecha(m.fechaImpacto),
  categoriaId: m.categoriaId,
  duenoId: m.duenoId,
  ambito: m.ambito,
  cuentaId: m.cuentaId,
  cuentaDestinoId: m.cuentaDestinoId,
  nota: m.nota,
  etiquetas: m.etiquetas,
  recurrenciaId: m.recurrenciaId,
  periodo: m.periodo,
  planCuotasId: m.planCuotasId,
  numeroCuota: m.numeroCuota,
  concepto: conceptoMovimiento(m),
  creadoPorId: m.creadoPorId,
});

export const recurrenciaDTO = (r: Recurrencia): RecurrenciaDTO => ({
  id: r.id,
  concepto: r.concepto,
  tipo: r.tipo === "ingreso" ? "ingreso" : "gasto",
  montoEstimado: dec(r.montoEstimado).toString(),
  montoMin: s(r.montoMin),
  montoMax: s(r.montoMax),
  moneda: r.moneda,
  frecuencia: r.frecuencia,
  mesAncla: r.mesAncla,
  diaDelMes: r.diaDelMes,
  desde: aFecha(r.desde),
  fechaFin: aFecha(r.fechaFin),
  reglaAjuste: r.reglaAjuste,
  categoriaId: r.categoriaId,
  duenoId: r.duenoId,
  ambito: r.ambito,
  cuentaId: r.cuentaId,
  etiquetas: r.etiquetas,
  nota: r.nota,
  activa: r.activa,
  montoMensual: montoMensual(dec(r.montoEstimado), r.frecuencia).toString(),
});

export function planCuotasDTO(p: PlanCuotas, hoy: Fecha): PlanCuotasDTO {
  const primera = aFecha(p.primeraFechaImpacto);
  const ultimaPasada = cuotaDelMes({ cantidadCuotas: p.cantidadCuotas, primeraFechaImpacto: primera }, mesDe(hoy));
  let pagadasDelPlan: number;
  if (hoy < primera) pagadasDelPlan = 0;
  else if (ultimaPasada == null) pagadasDelPlan = p.cantidadCuotas;
  else {
    // la cuota de este mes cuenta como pagada si su fecha ya pasó
    const fechaCuotaMes = sumarMesesFecha(primera, ultimaPasada - 1);
    pagadasDelPlan = fechaCuotaMes <= hoy ? ultimaPasada : ultimaPasada - 1;
  }
  const restantes = p.cantidadCuotas - pagadasDelPlan;
  return {
    id: p.id,
    descripcion: p.descripcion,
    montoCuota: dec(p.montoCuota).toString(),
    cantidadCuotas: p.cantidadCuotas,
    cuotasPrevias: p.cuotasPrevias,
    primeraFechaImpacto: primera,
    fechaCompra: aFecha(p.fechaCompra),
    cuentaId: p.cuentaId,
    categoriaId: p.categoriaId,
    duenoId: p.duenoId,
    ambito: p.ambito,
    pagadas: p.cuotasPrevias + pagadasDelPlan,
    total: p.cuotasPrevias + p.cantidadCuotas,
    restante: dec(p.montoCuota).times(restantes).toString(),
    proximaFecha: restantes > 0 ? sumarMesesFecha(primera, pagadasDelPlan) : null,
  };
}

export const eventoDTO = (e: Evento): EventoDTO => ({
  id: e.id,
  nombre: e.nombre,
  mes: e.mes,
  dia: e.dia,
  montoPresupuestado: dec(e.montoPresupuestado).toString(),
  categoriaId: e.categoriaId,
  duenoId: e.duenoId,
  activo: e.activo,
});

export const cotizacionDTO = (c: Cotizacion): CotizacionDTO => ({
  id: c.id,
  fecha: aFecha(c.fecha),
  tipo: c.tipo,
  valor: dec(c.valor).toString(),
});

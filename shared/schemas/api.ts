/**
 * Contrato de la API: schemas zod de entrada (compartidos con el front) y tipos de salida (DTOs).
 * Los montos viajan siempre como string decimal ("1234.56"), nunca como number.
 */
import { z } from "zod";
import { esFecha, esMes } from "../domain/fechas.js";
import type { Alerta, Origen, Rubro } from "../domain/proyeccion.js";
import {
  AMBITOS,
  FRECUENCIAS,
  MONEDAS,
  TIPOS_CUENTA,
  TIPOS_MOVIMIENTO,
  type Ambito,
  type EstadoMovimiento,
  type Fecha,
  type Frecuencia,
  type Mes,
  type Moneda,
  type TipoCuenta,
  type TipoMovimiento,
} from "../domain/tipos.js";
import { ICONOS } from "../iconos.js";

// ─── Piezas ──────────────────────────────────────────────────────────────

export const zMonto = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v), "Monto inválido (máximo 2 decimales)")
  .refine((v) => Number(v) > 0, "El monto tiene que ser mayor a cero");
export const zMontoCero = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^-?\d{1,12}(\.\d{1,2})?$/.test(v), "Monto inválido (máximo 2 decimales)");
export const zCotizacion = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d{1,10}(\.\d{1,4})?$/.test(v) && Number(v) > 0, "Cotización inválida");
export const zFecha = z.string().refine(esFecha, "Fecha inválida (AAAA-MM-DD)");
export const zMes = z.string().refine(esMes, "Mes inválido (AAAA-MM)");
export const zId = z.string().min(1).max(64);
export const zMoneda = z.enum(MONEDAS as [Moneda, ...Moneda[]]);
export const zAmbito = z.enum(AMBITOS as [Ambito, ...Ambito[]]);
export const zFrecuencia = z.enum(FRECUENCIAS as [Frecuencia, ...Frecuencia[]]);
export const zTipoCuenta = z.enum(TIPOS_CUENTA as [TipoCuenta, ...TipoCuenta[]]);
export const zTipoMovimiento = z.enum(TIPOS_MOVIMIENTO as [TipoMovimiento, ...TipoMovimiento[]]);
export const zIcono = z.enum(ICONOS);
export const zColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido (#RRGGBB)");
const zTexto = (max: number) => z.string().trim().min(1, "No puede estar vacío").max(max);
const zEtiquetas = z.array(z.string().trim().toLowerCase().min(1).max(30)).max(10).default([]);
const zDia = z.number().int().min(1).max(31);

// ─── Entradas ────────────────────────────────────────────────────────────

export const movimientoInput = z
  .object({
    tipo: zTipoMovimiento,
    monto: zMonto,
    moneda: zMoneda.default("ARS"),
    cotizacion: zCotizacion.nullish(),
    fechaConsumo: zFecha,
    /** Si no viene, se calcula según la cuenta (tarjetas: a mes vencido). */
    fechaImpacto: zFecha.nullish(),
    categoriaId: zId.nullish(),
    /** Si no viene, quien carga. */
    duenoId: zId.nullish(),
    /** Si no viene, el ámbito por defecto de la categoría. */
    ambito: zAmbito.nullish(),
    cuentaId: zId,
    cuentaDestinoId: zId.nullish(),
    nota: z.string().trim().max(500).nullish(),
    etiquetas: zEtiquetas,
  })
  .superRefine((m, ctx) => {
    if (m.tipo === "transferencia") {
      if (!m.cuentaDestinoId) ctx.addIssue({ code: "custom", path: ["cuentaDestinoId"], message: "Elegí la cuenta de destino" });
      else if (m.cuentaDestinoId === m.cuentaId) ctx.addIssue({ code: "custom", path: ["cuentaDestinoId"], message: "Origen y destino tienen que ser distintos" });
    } else if (m.cuentaDestinoId) {
      ctx.addIssue({ code: "custom", path: ["cuentaDestinoId"], message: "Solo las transferencias tienen cuenta de destino" });
    }
  });
export type MovimientoInput = z.input<typeof movimientoInput>;

export const movimientoPatch = z.object({
  tipo: zTipoMovimiento.optional(),
  monto: zMonto.optional(),
  moneda: zMoneda.optional(),
  cotizacion: zCotizacion.nullish(),
  fechaConsumo: zFecha.optional(),
  fechaImpacto: zFecha.nullish(),
  categoriaId: zId.nullish(),
  duenoId: zId.optional(),
  ambito: zAmbito.optional(),
  cuentaId: zId.optional(),
  cuentaDestinoId: zId.nullish(),
  nota: z.string().trim().max(500).nullish(),
  etiquetas: zEtiquetas.optional(),
  estado: z.enum(["confirmado", "pendiente", "omitido"]).optional(),
});
export type MovimientoPatch = z.input<typeof movimientoPatch>;

export const confirmarInput = z.object({
  monto: zMonto.optional(),
  fechaConsumo: zFecha.optional(),
  duenoId: zId.optional(),
  cuentaId: zId.optional(),
});
export type ConfirmarInput = z.input<typeof confirmarInput>;

export const recurrenciaInput = z
  .object({
    concepto: zTexto(80),
    tipo: z.enum(["ingreso", "gasto"]),
    montoEstimado: zMonto,
    montoMin: zMonto.nullish(),
    montoMax: zMonto.nullish(),
    moneda: zMoneda.default("ARS"),
    frecuencia: zFrecuencia.default("mensual"),
    mesAncla: zMes,
    diaDelMes: zDia.default(1),
    desde: zFecha.nullish(),
    fechaFin: zFecha.nullish(),
    reglaAjuste: z.string().trim().max(120).nullish(),
    categoriaId: zId.nullish(),
    /** null = la paga quien pase. */
    duenoId: zId.nullish(),
    ambito: zAmbito.default("compartido"),
    cuentaId: zId,
    etiquetas: zEtiquetas,
    nota: z.string().trim().max(500).nullish(),
    activa: z.boolean().default(true),
  })
  .refine((r) => !r.montoMin || !r.montoMax || Number(r.montoMin) <= Number(r.montoMax), {
    path: ["montoMax"],
    message: "El máximo tiene que ser mayor al mínimo",
  });
export type RecurrenciaInput = z.input<typeof recurrenciaInput>;

export const planCuotasInput = z
  .object({
    descripcion: zTexto(80),
    montoCuota: zMonto,
    cantidadCuotas: z.number().int().min(1).max(120),
    cuotasPrevias: z.number().int().min(0).max(119).default(0),
    fechaCompra: zFecha.nullish(),
    /** Si no viene, se calcula desde la fecha de compra y la cuenta. */
    primeraFechaImpacto: zFecha.nullish(),
    cuentaId: zId,
    categoriaId: zId.nullish(),
    duenoId: zId.nullish(),
    ambito: zAmbito.nullish(),
    nota: z.string().trim().max(500).nullish(),
  })
  .refine((p) => p.fechaCompra || p.primeraFechaImpacto, {
    path: ["fechaCompra"],
    message: "Indicá la fecha de compra o la de la primera cuota",
  });
export type PlanCuotasInput = z.input<typeof planCuotasInput>;

export const cuentaInput = z.object({
  nombre: zTexto(60),
  tipo: zTipoCuenta,
  moneda: zMoneda.default("ARS"),
  titularId: zId,
  saldoInicial: zMontoCero.default("0"),
  fechaSaldoInicial: zFecha.nullish(),
  tna: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v), "TNA inválida")
    .nullish(),
  diaCierre: zDia.nullish(),
  diaVencimiento: zDia.nullish(),
  orden: z.number().int().default(0),
  archivada: z.boolean().default(false),
});
export type CuentaInput = z.input<typeof cuentaInput>;

export const categoriaInput = z.object({
  nombre: zTexto(40),
  tipo: z.enum(["gasto", "ingreso"]).default("gasto"),
  padreId: zId.nullish(),
  icono: zIcono.default("circle"),
  color: zColor.default("#64748b"),
  ambitoDefault: zAmbito.default("compartido"),
  orden: z.number().int().default(0),
  archivada: z.boolean().default(false),
});
export type CategoriaInput = z.input<typeof categoriaInput>;

export const personaInput = z.object({
  nombre: zTexto(40),
  email: z.email("Email inválido").toLowerCase().nullish(),
  color: zColor.default("#16a34a"),
  orden: z.number().int().default(0),
});
export type PersonaInput = z.input<typeof personaInput>;

export const eventoInput = z.object({
  nombre: zTexto(80),
  mes: z.number().int().min(1).max(12),
  dia: zDia.nullish(),
  montoPresupuestado: zMonto,
  categoriaId: zId.nullish(),
  duenoId: zId.nullish(),
  activo: z.boolean().default(true),
});
export type EventoInput = z.input<typeof eventoInput>;

export const cotizacionInput = z.object({
  fecha: zFecha,
  tipo: z.enum(["oficial", "mep"]).default("oficial"),
  valor: zCotizacion,
});
export type CotizacionInput = z.input<typeof cotizacionInput>;

export const configPatch = z.object({
  nombreHogar: zTexto(60).optional(),
  umbralMargenBajo: zMontoCero.optional(),
});
export type ConfigPatch = z.input<typeof configPatch>;

export const aiParseInput = z.object({ texto: z.string().trim().min(2).max(300) });

// ─── Salidas (DTOs) ──────────────────────────────────────────────────────

export interface ConfigDTO {
  nombreHogar: string;
  monedaBase: Moneda;
  locale: string;
  timezone: string;
  umbralMargenBajo: string;
}

export interface PersonaDTO {
  id: string;
  nombre: string;
  email: string | null;
  color: string;
  orden: number;
}

export interface CuentaDTO {
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  moneda: Moneda;
  titularId: string;
  saldoInicial: string;
  fechaSaldoInicial: Fecha | null;
  tna: string | null;
  diaCierre: number | null;
  diaVencimiento: number | null;
  orden: number;
  archivada: boolean;
}

export interface CategoriaDTO {
  id: string;
  nombre: string;
  tipo: "gasto" | "ingreso";
  padreId: string | null;
  icono: string;
  color: string;
  ambitoDefault: Ambito;
  orden: number;
  archivada: boolean;
}

export interface MovimientoDTO {
  id: string;
  tipo: TipoMovimiento;
  estado: EstadoMovimiento;
  monto: string;
  moneda: Moneda;
  cotizacion: string | null;
  /** Monto en la moneda base del hogar. */
  montoBase: string;
  fechaConsumo: Fecha;
  fechaImpacto: Fecha;
  categoriaId: string | null;
  duenoId: string;
  ambito: Ambito;
  cuentaId: string;
  cuentaDestinoId: string | null;
  nota: string | null;
  etiquetas: string[];
  recurrenciaId: string | null;
  periodo: Mes | null;
  planCuotasId: string | null;
  numeroCuota: number | null;
  /** "Silla de comer · 3/12", "Alquiler"… */
  concepto: string;
  creadoPorId: string | null;
}

export interface RecurrenciaDTO {
  id: string;
  concepto: string;
  tipo: "ingreso" | "gasto";
  montoEstimado: string;
  montoMin: string | null;
  montoMax: string | null;
  moneda: Moneda;
  frecuencia: Frecuencia;
  mesAncla: Mes;
  diaDelMes: number;
  desde: Fecha | null;
  fechaFin: Fecha | null;
  reglaAjuste: string | null;
  categoriaId: string | null;
  duenoId: string | null;
  ambito: Ambito;
  cuentaId: string;
  etiquetas: string[];
  nota: string | null;
  activa: boolean;
  /** Equivalente mensual (prorrateo). */
  montoMensual: string;
}

export interface PlanCuotasDTO {
  id: string;
  descripcion: string;
  montoCuota: string;
  cantidadCuotas: number;
  cuotasPrevias: number;
  primeraFechaImpacto: Fecha;
  fechaCompra: Fecha | null;
  cuentaId: string;
  categoriaId: string | null;
  duenoId: string;
  ambito: Ambito;
  /** Cuotas con fecha de impacto ya pasada (incluye las previas). */
  pagadas: number;
  total: number;
  restante: string;
  proximaFecha: Fecha | null;
}

export interface EventoDTO {
  id: string;
  nombre: string;
  mes: number;
  dia: number | null;
  montoPresupuestado: string;
  categoriaId: string | null;
  duenoId: string | null;
  activo: boolean;
}

export interface CotizacionDTO {
  id: string;
  fecha: Fecha;
  tipo: "oficial" | "mep";
  valor: string;
}

export interface BootstrapDTO {
  hoy: Fecha;
  config: ConfigDTO;
  yo: PersonaDTO;
  personas: PersonaDTO[];
  cuentas: CuentaDTO[];
  categorias: CategoriaDTO[];
  pendientes: number;
  ultimaCotizacion: CotizacionDTO | null;
  /** Última cuenta usada por categoría, para los defaults de la carga rápida. */
  cuentaPorCategoria: Record<string, string>;
  /** Categorías de gasto más usadas en los últimos 60 días (ids, de más a menos). */
  categoriasRecientes: string[];
  ia: boolean;
}

export interface TotalCategoriaDTO {
  categoriaId: string | null;
  total: string;
  cantidad: number;
  porcentaje: number | null;
}

export interface DashboardDTO {
  mes: Mes;
  vista: string;
  ingresos: string;
  gastos: string;
  enviadas: string;
  recibidas: string;
  ahorro: string;
  tasaAhorro: number | null;
  porCategoria: TotalCategoriaDTO[];
  top5: TotalCategoriaDTO[];
  hormiga: { categoriaId: string | null; cantidad: number; total: string; promedio: string }[];
  pendientes: { cantidad: number; ingresos: string; gastos: string };
  proximos: { mes: Mes; sobra: string; alerta: Alerta }[];
}

export interface LineaProyeccionDTO {
  rubro: Rubro;
  origen: Origen;
  concepto: string;
  monto: string;
  refId: string;
}

export interface MesProyeccionDTO {
  mes: Mes;
  ingresos: string;
  fijos: string;
  cuotas: string;
  eventos: string;
  variables: string;
  transferencias: string;
  sobra: string;
  acumulado: string;
  alerta: Alerta;
  lineas: LineaProyeccionDTO[];
}

export interface ProyeccionDTO {
  vista: string;
  umbral: string;
  meses: MesProyeccionDTO[];
  /** Avisos (ej. recurrencias en USD sin cotización cargada). */
  avisos: string[];
}

export interface AiParseDTO {
  borrador: Partial<{
    tipo: TipoMovimiento;
    monto: string;
    moneda: Moneda;
    fechaConsumo: Fecha;
    categoriaId: string;
    cuentaId: string;
    cuentaDestinoId: string;
    duenoId: string;
    ambito: Ambito;
    etiquetas: string[];
    nota: string;
    cuotas: number;
  }>;
}

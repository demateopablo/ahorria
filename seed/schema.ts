/**
 * Formato del archivo de datos iniciales del hogar (`seed/household.local.json`).
 * Pensado para escribirse a mano (o con el skill de Claude): todo se referencia por nombre.
 */
import { z } from "zod";
import { esFecha, esMes } from "../shared/domain/fechas.js";
import { AMBITOS, FRECUENCIAS, TIPOS_CUENTA, type Ambito, type Frecuencia, type TipoCuenta } from "../shared/domain/tipos.js";
import { ICONOS } from "../shared/iconos.js";

const monto = z
  .union([z.number(), z.string()])
  .transform((v) => String(v))
  .refine((v) => /^-?\d{1,12}(\.\d{1,4})?$/.test(v), "Monto inválido: usá punto decimal y sin separador de miles (ej. 55776.31)");
const mes = z.string().refine(esMes, "Mes inválido (AAAA-MM)");
const fecha = z.string().refine(esFecha, "Fecha inválida (AAAA-MM-DD)");
const ambito = z.enum(AMBITOS as [Ambito, ...Ambito[]]);
const icono = z.enum(ICONOS);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const categoria = z.object({
  nombre: z.string().min(1),
  tipo: z.enum(["gasto", "ingreso"]).default("gasto"),
  icono: icono.default("circle"),
  color: color.optional(),
  ambito: ambito.default("compartido"),
  subcategorias: z
    .array(z.object({ nombre: z.string().min(1), icono: icono.optional(), ambito: ambito.optional() }))
    .default([]),
});

export const householdSchema = z.object({
  hogar: z.object({
    nombre: z.string().min(1),
    /** Margen mensual por debajo del cual la proyección avisa en ámbar. */
    umbralMargenBajo: monto.default("0"),
  }),
  /** Mes desde el que arrancan los datos (recurrencias y cuotas en curso). Por defecto, el mes actual. */
  inicio: mes.optional(),
  personas: z
    .array(
      z.object({
        nombre: z.string().min(1),
        /** Email de Google con el que inicia sesión (sin email = no inicia sesión). */
        email: z.email().toLowerCase().nullish(),
        color: color.optional(),
      }),
    )
    .min(1),
  categorias: z.array(categoria).min(1),
  cuentas: z
    .array(
      z.object({
        nombre: z.string().min(1),
        tipo: z.enum(TIPOS_CUENTA as [TipoCuenta, ...TipoCuenta[]]),
        moneda: z.enum(["ARS", "USD"]).default("ARS"),
        titular: z.string(),
        saldoInicial: monto.optional(),
        /** TNA en % (ej. 19 = 19 %). */
        tna: monto.optional(),
        diaCierre: z.number().int().min(1).max(31).optional(),
        diaVencimiento: z.number().int().min(1).max(31).optional(),
      }),
    )
    .min(1),
  recurrencias: z
    .array(
      z.object({
        concepto: z.string().min(1),
        tipo: z.enum(["gasto", "ingreso"]).default("gasto"),
        monto,
        montoMin: monto.optional(),
        montoMax: monto.optional(),
        moneda: z.enum(["ARS", "USD"]).default("ARS"),
        frecuencia: z.enum(FRECUENCIAS as [Frecuencia, ...Frecuencia[]]).default("mensual"),
        /** Un mes en el que ocurre (fija la fase). Por defecto, `inicio`. */
        mesAncla: mes.optional(),
        dia: z.number().int().min(1).max(31).default(1),
        /** Primer mes en que corre (ej. "2026-12"). */
        desde: mes.optional(),
        /** Última fecha (ej. fin de un plan de pagos). */
        hasta: fecha.optional(),
        /** Nombre de la persona, o null = "la paga quien pase". */
        dueno: z.string().nullable(),
        ambito: ambito.optional(),
        cuenta: z.string(),
        categoria: z.string().optional(),
        etiquetas: z.array(z.string()).default([]),
        reglaAjuste: z.string().optional(),
        nota: z.string().optional(),
        /** Gasto variable (súper, nafta): se carga compra por compra, sin pendientes. */
        variable: z.boolean().default(false),
      }),
    )
    .default([]),
  cuotas: z
    .array(
      z
        .object({
          descripcion: z.string().min(1),
          montoCuota: monto,
          cuenta: z.string(),
          categoria: z.string().optional(),
          dueno: z.string().optional(),
          ambito: ambito.optional(),
          /** Compra nueva: cantidad total de cuotas + fecha de compra. */
          cantidad: z.number().int().min(1).max(120).optional(),
          fechaCompra: fecha.optional(),
          /** Plan que ya venía corriendo: mes de la última cuota (se cargan desde `inicio`). */
          ultimaCuota: mes.optional(),
        })
        .refine((c) => (c.cantidad && c.fechaCompra) || c.ultimaCuota, "Indicá cantidad + fechaCompra, o ultimaCuota"),
    )
    .default([]),
  eventos: z
    .array(
      z.object({
        nombre: z.string().min(1),
        mes: z.number().int().min(1).max(12),
        dia: z.number().int().min(1).max(31).optional(),
        monto,
        categoria: z.string().optional(),
        dueno: z.string().optional(),
      }),
    )
    .default([]),
  cotizaciones: z
    .array(z.object({ fecha, tipo: z.enum(["oficial", "mep"]).default("oficial"), valor: monto }))
    .default([]),
});

export type Household = z.output<typeof householdSchema>;
export type HouseholdInput = z.input<typeof householdSchema>;

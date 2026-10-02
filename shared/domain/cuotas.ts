import type { Decimal } from "decimal.js";
import { dec, type MontoInput } from "./dinero.js";
import { difMeses, sumarMesesFecha } from "./fechas.js";
import type { Fecha, Mes } from "./tipos.js";

export interface PlanCuotasCalendario {
  montoCuota: MontoInput;
  cantidadCuotas: number;
  primeraFechaImpacto: Fecha;
}

export interface ImpactoCuota {
  numero: number;
  fechaImpacto: Fecha;
  monto: Decimal;
}

/** Una compra en N cuotas genera N impactos, uno por mes desde la primera fecha. */
export function impactosCuotas(plan: PlanCuotasCalendario): ImpactoCuota[] {
  if (!Number.isInteger(plan.cantidadCuotas) || plan.cantidadCuotas < 1) {
    throw new Error("La cantidad de cuotas tiene que ser un entero mayor a cero");
  }
  return Array.from({ length: plan.cantidadCuotas }, (_, i) => ({
    numero: i + 1,
    fechaImpacto: sumarMesesFecha(plan.primeraFechaImpacto, i),
    monto: dec(plan.montoCuota),
  }));
}

/**
 * Para planes que ya venían corriendo y solo se sabe cuándo es la última cuota:
 * cuántas cuotas quedan desde `desde` (inclusive) hasta `ultima` (inclusive).
 */
export function cuotasRestantes(desde: Mes, ultima: Mes): number {
  return Math.max(0, difMeses(desde, ultima) + 1);
}

/** Número de cuota que corresponde a un mes, o null si el plan no tiene cuota ese mes. */
export function cuotaDelMes(plan: Pick<PlanCuotasCalendario, "cantidadCuotas" | "primeraFechaImpacto">, mes: Mes): number | null {
  const n = difMeses(plan.primeraFechaImpacto.slice(0, 7), mes) + 1;
  return n >= 1 && n <= plan.cantidadCuotas ? n : null;
}

import { Decimal } from "decimal.js";
import type { Moneda } from "./tipos.js";

export { Decimal };
export type MontoInput = Decimal | string | number;

export const CERO = new Decimal(0);

/** Acepta Decimal, string, number o cualquier objeto Decimal-like (ej. Prisma.Decimal). */
export function dec(v: MontoInput | { toString(): string }): Decimal {
  if (v instanceof Decimal) return v;
  return new Decimal(typeof v === "number" || typeof v === "string" ? v : v.toString());
}

export function sumar(montos: Iterable<MontoInput>): Decimal {
  let total = CERO;
  for (const m of montos) total = total.plus(dec(m));
  return total;
}

/** Redondeo a centavos, half-up (como en cualquier ticket). */
export function centavos(m: MontoInput): Decimal {
  return dec(m).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Convierte un monto a la moneda base del hogar.
 * `cotizacion` es siempre "pesos por dólar" (ej. 1.415,50), sea cual sea la base.
 */
export function aMonedaBase(monto: MontoInput, moneda: Moneda, base: Moneda, cotizacion?: MontoInput | null): Decimal {
  if (moneda === base) return dec(monto);
  if (cotizacion == null) throw new Error(`Falta la cotización para convertir ${moneda} a ${base}`);
  const c = dec(cotizacion);
  if (c.lte(0)) throw new Error("La cotización tiene que ser mayor a cero");
  return centavos(base === "ARS" ? dec(monto).times(c) : dec(monto).dividedBy(c));
}

/** Porcentaje (0–100) con un decimal, o null si el total es cero. */
export function porcentaje(parte: MontoInput, total: MontoInput): number | null {
  const t = dec(total);
  if (t.isZero()) return null;
  return dec(parte).dividedBy(t).times(100).toDecimalPlaces(1).toNumber();
}

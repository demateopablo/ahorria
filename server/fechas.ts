import type { Fecha } from "../shared/domain/tipos.js";

/** DATE de Postgres (Prisma lo devuelve como medianoche UTC) → "YYYY-MM-DD". */
export function aFecha(d: Date): Fecha;
export function aFecha(d: Date | null | undefined): Fecha | null;
export function aFecha(d: Date | null | undefined): Fecha | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** "YYYY-MM-DD" → Date a medianoche UTC, para columnas DATE. */
export function deFecha(f: Fecha): Date;
export function deFecha(f: Fecha | null | undefined): Date | null;
export function deFecha(f: Fecha | null | undefined): Date | null {
  return f ? new Date(`${f}T00:00:00.000Z`) : null;
}

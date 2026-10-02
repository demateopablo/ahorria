import { HOGAR, type MovimientoCalc, type Vista } from "./tipos.js";

export type Efecto = "ingreso" | "gasto" | "enviada" | "recibida";

/**
 * Cómo cuenta un movimiento en una vista (o null si no cuenta).
 *
 * Regla de oro: una transferencia NUNCA es gasto ni ingreso. Si Ana le da efectivo a Leo
 * para pagar la tarjeta de él, el gasto real es el consumo de la tarjeta de Leo.
 * - En la vista Hogar las transferencias no existen (la plata no sale del hogar).
 * - En la vista de una persona aparecen aparte, como enviadas o recibidas.
 * - Entre cuentas de la misma persona no cuentan en ninguna vista.
 */
export function efectoEnVista(mov: MovimientoCalc, vista: Vista): Efecto | null {
  if (mov.estado === "omitido") return null;

  if (mov.tipo !== "transferencia") {
    if (vista !== HOGAR && mov.duenoId !== vista) return null;
    return mov.tipo;
  }

  if (vista === HOGAR) return null;
  const origen = mov.personaOrigenId ?? mov.duenoId;
  const destino = mov.personaDestinoId ?? null;
  if (origen === destino) return null;
  if (origen === vista) return "enviada";
  if (destino === vista) return "recibida";
  return null;
}

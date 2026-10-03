import { resumenTarjeta } from "@shared/domain/impacto";
import { formatFecha } from "@shared/format";
import type { CuentaDTO } from "@shared/schemas/api";

/** "Entra en el resumen que cierra el 1 nov y se paga el 14 nov" (null si la cuenta no es tarjeta). */
export function textoResumen(fechaConsumo: string, cuenta: CuentaDTO | undefined): string | null {
  if (cuenta?.tipo !== "tarjeta_credito") return null;
  const r = resumenTarjeta(fechaConsumo, cuenta);
  const paga = `se paga el ${formatFecha(r.vencimiento, true)}`;
  return r.cierre ? `Entra en el resumen que cierra el ${formatFecha(r.cierre, true)} y ${paga}` : `Se paga en el resumen del mes siguiente (${formatFecha(r.vencimiento, true)})`;
}

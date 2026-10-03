import { diaDe, fechaEnMes, mesDe, sumarMeses } from "./fechas.js";
import type { CuentaImpacto, Fecha } from "./tipos.js";

/** Día de vencimiento cuando la tarjeta no lo tiene configurado. */
export const VENCIMIENTO_POR_DEFECTO = 10;

/**
 * Fecha en la que un consumo impacta en el flujo de caja.
 *
 * - Cuentas comunes: el mismo día.
 * - Tarjetas de crédito (se pagan a mes vencido):
 *   - con día de cierre: lo consumido hasta el cierre entra en el resumen que cierra ese mes; lo de
 *     después, en el que cierra el mes siguiente. El resumen vence el primer día de vencimiento
 *     posterior al cierre: el mismo mes si vence después del cierre (cierra el 1, vence el 14) o el
 *     siguiente si no (cierra el 25, vence el 5).
 *   - sin día de cierre: el mes siguiente.
 */
export function fechaImpacto(fechaConsumo: Fecha, cuenta: CuentaImpacto): Fecha {
  if (cuenta.tipo !== "tarjeta_credito") return fechaConsumo;
  return resumenTarjeta(fechaConsumo, cuenta).vencimiento;
}

/** El resumen en el que entra un consumo con tarjeta: cuándo cierra (si se sabe) y cuándo vence. */
export function resumenTarjeta(fechaConsumo: Fecha, cuenta: CuentaImpacto): { cierre: Fecha | null; vencimiento: Fecha } {
  const vencimiento = cuenta.diaVencimiento ?? VENCIMIENTO_POR_DEFECTO;
  if (cuenta.diaCierre == null) return { cierre: null, vencimiento: fechaEnMes(sumarMeses(mesDe(fechaConsumo), 1), vencimiento) };
  const mesCierre = sumarMeses(mesDe(fechaConsumo), diaDe(fechaConsumo) > cuenta.diaCierre ? 1 : 0);
  return {
    cierre: fechaEnMes(mesCierre, cuenta.diaCierre),
    vencimiento: fechaEnMes(sumarMeses(mesCierre, vencimiento > cuenta.diaCierre ? 0 : 1), vencimiento),
  };
}

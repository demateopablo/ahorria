import { diaDe, fechaEnMes, mesDe, sumarMeses } from "./fechas.js";
import type { CuentaImpacto, Fecha } from "./tipos.js";

/** Día de vencimiento cuando la tarjeta no lo tiene configurado. */
export const VENCIMIENTO_POR_DEFECTO = 10;

/**
 * Fecha en la que un consumo impacta en el flujo de caja.
 *
 * - Cuentas comunes: el mismo día.
 * - Tarjetas de crédito (se pagan a mes vencido):
 *   - con día de cierre: lo consumido hasta el cierre se paga el mes siguiente; lo consumido
 *     después del cierre entra en el próximo resumen y se paga dos meses después.
 *   - sin día de cierre: el mes siguiente.
 */
export function fechaImpacto(fechaConsumo: Fecha, cuenta: CuentaImpacto): Fecha {
  if (cuenta.tipo !== "tarjeta_credito") return fechaConsumo;
  const vencimiento = cuenta.diaVencimiento ?? VENCIMIENTO_POR_DEFECTO;
  const despuesDelCierre = cuenta.diaCierre != null && diaDe(fechaConsumo) > cuenta.diaCierre;
  return fechaEnMes(sumarMeses(mesDe(fechaConsumo), despuesDelCierre ? 2 : 1), vencimiento);
}

import type { Decimal } from "decimal.js";

/** Fecha calendario sin hora ni zona: "2026-10-31". */
export type Fecha = string;
/** Mes calendario: "2026-10". */
export type Mes = string;

export type Moneda = "ARS" | "USD";
export type TipoCuenta = "efectivo" | "billetera" | "banco" | "tarjeta_credito" | "inversion";
export type TipoMovimiento = "ingreso" | "gasto" | "transferencia";
export type Ambito = "personal" | "compartido" | "negocio" | "familia";
export type EstadoMovimiento = "confirmado" | "pendiente" | "omitido";
export type Frecuencia = "mensual" | "bimestral" | "trimestral" | "semestral" | "anual";

/** "hogar" o el id de una Persona. */
export type Vista = string;
export const HOGAR = "hogar";

export const MONEDAS: readonly Moneda[] = ["ARS", "USD"];
export const AMBITOS: readonly Ambito[] = ["personal", "compartido", "negocio", "familia"];
export const FRECUENCIAS: readonly Frecuencia[] = ["mensual", "bimestral", "trimestral", "semestral", "anual"];
export const TIPOS_CUENTA: readonly TipoCuenta[] = ["efectivo", "billetera", "banco", "tarjeta_credito", "inversion"];
export const TIPOS_MOVIMIENTO: readonly TipoMovimiento[] = ["ingreso", "gasto", "transferencia"];

export interface CuentaImpacto {
  tipo: TipoCuenta;
  diaCierre?: number | null;
  diaVencimiento?: number | null;
}

/**
 * Movimiento normalizado para los cálculos: monto en la moneda base del hogar y,
 * en las transferencias, los titulares de las cuentas de origen y destino ya resueltos.
 */
export interface MovimientoCalc {
  id: string;
  tipo: TipoMovimiento;
  estado: EstadoMovimiento;
  /** Monto en moneda base, siempre positivo. */
  monto: Decimal;
  fechaImpacto: Fecha;
  categoriaId: string | null;
  duenoId: string;
  /** Titular de la cuenta de origen (solo transferencias). */
  personaOrigenId?: string | null;
  /** Titular de la cuenta de destino (solo transferencias). */
  personaDestinoId?: string | null;
  recurrenciaId?: string | null;
  /** Mes de consumo que cubre un movimiento generado por una recurrencia. */
  periodo?: Mes | null;
  planCuotasId?: string | null;
  /** Texto para mostrar en detalles (nota, concepto de la recurrencia o del plan). */
  concepto?: string;
}

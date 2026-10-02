import type { Decimal } from "decimal.js";
import { CERO, dec, type MontoInput } from "./dinero.js";
import { difMeses, fechaEnMes, mesDe, sumarMeses } from "./fechas.js";
import type { Fecha, Frecuencia, Mes } from "./tipos.js";

export const MESES_POR_FRECUENCIA: Record<Frecuencia, number> = {
  mensual: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

export interface RecurrenciaCalendario {
  frecuencia: Frecuencia;
  /** Un mes en el que la recurrencia ocurre: fija la "fase" del ciclo. */
  mesAncla: Mes;
  diaDelMes: number;
  /** Primer mes posible (ej. pañales desde dic 2026). */
  desde?: Fecha | null;
  /** Última fecha posible (ej. plan de pagos que termina el 15/04/2027). */
  fechaFin?: Fecha | null;
  activa?: boolean;
}

/** ¿La recurrencia ocurre en ese mes? */
export function ocurreEn(rec: RecurrenciaCalendario, mes: Mes): boolean {
  if (rec.activa === false) return false;
  const paso = MESES_POR_FRECUENCIA[rec.frecuencia];
  const dif = difMeses(rec.mesAncla, mes);
  if (((dif % paso) + paso) % paso !== 0) return false;
  if (rec.desde && mes < mesDe(rec.desde)) return false;
  if (rec.fechaFin && fechaOcurrencia(rec, mes) > rec.fechaFin) return false;
  return true;
}

/** Fecha (de consumo) de la ocurrencia en un mes. */
export function fechaOcurrencia(rec: Pick<RecurrenciaCalendario, "diaDelMes">, mes: Mes): Fecha {
  return fechaEnMes(mes, rec.diaDelMes);
}

/** Meses (inclusive) entre `desde` y `hasta` en los que ocurre la recurrencia. */
export function periodos(rec: RecurrenciaCalendario, desde: Mes, hasta: Mes): Mes[] {
  const res: Mes[] = [];
  for (let m = desde; m <= hasta; m = sumarMeses(m, 1)) if (ocurreEn(rec, m)) res.push(m);
  return res;
}

/** Equivalente mensual (prorrateo): un gasto bimestral de 90.000 son 45.000 por mes. */
export function montoMensual(monto: MontoInput, frecuencia: Frecuencia): Decimal {
  return dec(monto).dividedBy(MESES_POR_FRECUENCIA[frecuencia]).toDecimalPlaces(2);
}

/** Suma del prorrateo mensual de varias recurrencias. */
export function prorrateoTotal(items: { monto: MontoInput; frecuencia: Frecuencia }[]): Decimal {
  return items.reduce((acc, i) => acc.plus(montoMensual(i.monto, i.frecuencia)), CERO);
}

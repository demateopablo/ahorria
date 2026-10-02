import type { Fecha, Mes } from "./tipos.js";

const pad = (n: number) => String(n).padStart(2, "0");

export function partesMes(mes: Mes): [number, number] {
  const [y, m] = mes.split("-").map(Number);
  return [y, m];
}

export function mesDe(fecha: Fecha): Mes {
  return fecha.slice(0, 7);
}

export function diasDelMes(mes: Mes): number {
  const [y, m] = partesMes(mes);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function sumarMeses(mes: Mes, n: number): Mes {
  const [y, m] = partesMes(mes);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** Meses de `desde` a `hasta` (positivo si `hasta` es posterior). */
export function difMeses(desde: Mes, hasta: Mes): number {
  const [y1, m1] = partesMes(desde);
  const [y2, m2] = partesMes(hasta);
  return (y2 - y1) * 12 + (m2 - m1);
}

/** Fecha del día `dia` del mes, recortada al último día (31 en febrero → 28/29). */
export function fechaEnMes(mes: Mes, dia: number): Fecha {
  return `${mes}-${pad(Math.min(Math.max(1, dia), diasDelMes(mes)))}`;
}

export function diaDe(fecha: Fecha): number {
  return Number(fecha.slice(8, 10));
}

export function sumarMesesFecha(fecha: Fecha, n: number): Fecha {
  return fechaEnMes(sumarMeses(mesDe(fecha), n), diaDe(fecha));
}

export function rangoMeses(desde: Mes, cantidad: number): Mes[] {
  return Array.from({ length: cantidad }, (_, i) => sumarMeses(desde, i));
}

export function ultimoDia(mes: Mes): Fecha {
  return fechaEnMes(mes, 31);
}

/** Hoy en la zona horaria del hogar, como "YYYY-MM-DD". */
export function hoy(timeZone = "America/Argentina/Buenos_Aires", ahora = new Date()): Fecha {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}

export function esMes(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function esFecha(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s) && diaDe(s) <= diasDelMes(mesDe(s));
}

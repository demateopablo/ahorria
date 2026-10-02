import type { MontoInput } from "./domain/dinero.js";
import { dec } from "./domain/dinero.js";
import type { Fecha, Mes, Moneda } from "./domain/tipos.js";

const cache = new Map<string, Intl.NumberFormat>();

function nf(locale: string, moneda: Moneda, decimales: number): Intl.NumberFormat {
  const key = `${locale}|${moneda}|${decimales}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: moneda,
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    });
    cache.set(key, f);
  }
  return f;
}

/**
 * "$ 1.234.567,89". Con `compacto` se omiten los centavos cuando son cero ("$ 820.000").
 * Formatea desde el string del Decimal para no perder precisión en montos grandes.
 */
export function formatMonto(monto: MontoInput, moneda: Moneda = "ARS", opts: { locale?: string; compacto?: boolean } = {}): string {
  const d = dec(monto);
  const decimales = opts.compacto && d.isInteger() ? 0 : 2;
  const valor = d.toDecimalPlaces(decimales).toFixed(decimales);
  // Intl acepta strings decimales exactos (Intl.NumberFormat v3).
  return nf(opts.locale ?? "es-AR", moneda, decimales)
    .format(valor as unknown as number)
    .replace(/ /g, " ");
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "octubre 2026" o, con `corto`, "oct 26". */
export function formatMes(mes: Mes, corto = false): string {
  const [y, m] = mes.split("-").map(Number);
  const nombre = MESES[m - 1];
  return corto ? `${nombre.slice(0, 3)} ${String(y).slice(2)}` : `${nombre} ${y}`;
}

/** "31/10/2026" o, con `corto`, "31 oct". */
export function formatFecha(fecha: Fecha, corto = false): string {
  const [y, m, d] = fecha.split("-");
  return corto ? `${Number(d)} ${MESES[Number(m) - 1].slice(0, 3)}` : `${d}/${m}/${y}`;
}

/**
 * Interpreta un monto escrito a la argentina: "1.234,56", "1234,5", "45000" o "45.000".
 * Devuelve el string decimal normalizado ("1234.56") o null si no es un número válido.
 */
export function parseMontoAR(texto: string): string | null {
  const t = texto.trim().replace(/\s|\$/g, "");
  if (!t) return null;
  let normal: string;
  if (t.includes(",")) {
    normal = t.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    normal = t.replace(/\./g, "");
  } else {
    normal = t;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return null;
  return normal;
}

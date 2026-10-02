/**
 * Cotización automática del dólar: una vez por día se trae el oficial (Banco Nación, venta) y el MEP
 * de dolarapi.com; si no responde, el oficial sale de la API pública del BCRA. Se guarda con fecha
 * de hoy (las cargadas a mano para ese día y tipo no se pisan).
 */
import type { Fecha } from "../../shared/domain/tipos.js";
import type { PrismaClient } from "../db.js";
import { deFecha } from "../fechas.js";

const TIMEOUT_MS = 4000;
/** Si una actualización falla, no se reintenta en cada request: como mucho cada 10 minutos por instancia. */
const ESPERA_REINTENTO_MS = 10 * 60 * 1000;
let ultimoIntento = 0;

type Tipo = "oficial" | "mep";

async function json(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

const numeroValido = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

async function deDolarApi(): Promise<Partial<Record<Tipo, number>>> {
  const [oficial, bolsa] = await Promise.allSettled([json("https://dolarapi.com/v1/dolares/oficial"), json("https://dolarapi.com/v1/dolares/bolsa")]);
  const venta = (r: PromiseSettledResult<unknown>) => (r.status === "fulfilled" ? (r.value as { venta?: unknown }).venta : undefined);
  const res: Partial<Record<Tipo, number>> = {};
  const o = venta(oficial);
  const m = venta(bolsa);
  if (numeroValido(o)) res.oficial = o;
  if (numeroValido(m)) res.mep = m;
  return res;
}

async function deBcra(): Promise<number | undefined> {
  const r = (await json("https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD?limit=10")) as {
    results?: { detalle?: { tipoCotizacion?: unknown }[] }[];
  };
  const v = r.results?.[0]?.detalle?.[0]?.tipoCotizacion;
  return numeroValido(v) ? v : undefined;
}

/** Trae las cotizaciones de hoy si todavía no están. Nunca tira: si las fuentes fallan, sigue con lo que hay. */
export async function actualizarCotizaciones(p: PrismaClient, hoy: Fecha): Promise<void> {
  if (process.env.COTIZACION_AUTOMATICA === "false" || process.env.VITEST) return;
  if (Date.now() - ultimoIntento < ESPERA_REINTENTO_MS) return;
  const fecha = deFecha(hoy);
  const existentes = await p.cotizacion.findMany({ where: { fecha }, select: { tipo: true } });
  const faltan = (["oficial", "mep"] as const).filter((t) => !existentes.some((e) => e.tipo === t));
  if (!faltan.length) return;

  ultimoIntento = Date.now();
  try {
    const valores = await deDolarApi().catch(() => ({}) as Partial<Record<Tipo, number>>);
    if (valores.oficial === undefined) valores.oficial = await deBcra().catch(() => undefined);
    for (const tipo of faltan) {
      const valor = valores[tipo];
      if (valor === undefined) continue;
      await p.cotizacion.upsert({ where: { fecha_tipo: { fecha, tipo } }, create: { fecha, tipo, valor: String(valor) }, update: {} });
    }
  } catch (e) {
    console.warn("No se pudo actualizar la cotización del dólar:", e instanceof Error ? e.message : e);
  }
}

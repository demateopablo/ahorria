import { dec } from "../../shared/domain/dinero.js";
import { hoy as hoyEn } from "../../shared/domain/fechas.js";
import type { Fecha, Moneda } from "../../shared/domain/tipos.js";
import type { PrismaClient } from "../db.js";
import type { Config } from "../generated/prisma/client.js";
import { HttpError } from "../http.js";
import { actualizarCotizaciones } from "./cotizaciones.js";

export interface Contexto {
  config: Config;
  hoy: Fecha;
  base: Moneda;
  /** Última cotización cargada (pesos por dólar), para USD sin cotización propia. */
  cotizacion: string | null;
}

export async function cargarContexto(p: PrismaClient): Promise<Contexto> {
  const config = await p.config.findUnique({ where: { id: 1 } });
  if (!config) throw new HttpError(503, "El hogar todavía no está configurado: corré `npm run seed`");
  const hoy = hoyEn(config.timezone);
  await actualizarCotizaciones(p, hoy);
  // Para convertir se usa el oficial más reciente; si nunca hubo oficial, cualquier otra.
  const cot =
    (await p.cotizacion.findFirst({ where: { tipo: "oficial" }, orderBy: { fecha: "desc" } })) ??
    (await p.cotizacion.findFirst({ orderBy: { fecha: "desc" } }));
  return {
    config,
    hoy,
    base: config.monedaBase,
    cotizacion: cot ? dec(cot.valor).toString() : null,
  };
}

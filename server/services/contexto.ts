import { dec } from "../../shared/domain/dinero.js";
import { hoy as hoyEn } from "../../shared/domain/fechas.js";
import type { Fecha, Moneda } from "../../shared/domain/tipos.js";
import type { PrismaClient } from "../db.js";
import type { Config } from "../generated/prisma/client.js";
import { HttpError } from "../http.js";

export interface Contexto {
  config: Config;
  hoy: Fecha;
  base: Moneda;
  /** Última cotización cargada (pesos por dólar), para USD sin cotización propia. */
  cotizacion: string | null;
}

export async function cargarContexto(p: PrismaClient): Promise<Contexto> {
  const [config, cot] = await Promise.all([
    p.config.findUnique({ where: { id: 1 } }),
    p.cotizacion.findFirst({ orderBy: [{ fecha: "desc" }, { tipo: "asc" }] }),
  ]);
  if (!config) throw new HttpError(503, "El hogar todavía no está configurado: corré `npm run seed`");
  return {
    config,
    hoy: hoyEn(config.timezone),
    base: config.monedaBase,
    cotizacion: cot ? dec(cot.valor).toString() : null,
  };
}

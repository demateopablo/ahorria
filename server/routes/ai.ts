import { Hono } from "hono";
import { z } from "zod";
import { esFecha } from "../../shared/domain/fechas.js";
import { aiParseInput, type AiParseDTO } from "../../shared/schemas/api.js";
import { cuerpo } from "../http.js";
import { completar, extraerJson } from "../llm.js";
import { cargarContexto } from "../services/contexto.js";
import type { AppEnv } from "../tipos-hono.js";

export const ai = new Hono<AppEnv>();

const respuesta = z.object({
  tipo: z.enum(["ingreso", "gasto", "transferencia"]).catch("gasto"),
  monto: z.union([z.string(), z.number()]).transform(String).optional().catch(undefined),
  moneda: z.enum(["ARS", "USD"]).optional().catch(undefined),
  fecha: z.string().optional().catch(undefined),
  categoria: z.string().nullish().catch(undefined),
  cuenta: z.string().nullish().catch(undefined),
  cuentaDestino: z.string().nullish().catch(undefined),
  dueno: z.string().nullish().catch(undefined),
  ambito: z.enum(["personal", "compartido", "negocio", "familia"]).nullish().catch(undefined),
  etiquetas: z.array(z.string()).optional().catch(undefined),
  nota: z.string().nullish().catch(undefined),
  cuotas: z.number().int().min(2).max(60).nullish().catch(undefined),
});

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Busca por nombre exacto (sin acentos) o, si no, por inclusión. */
function buscar<T extends { id: string; nombre: string }>(lista: T[], nombre: string | null | undefined): string | undefined {
  if (!nombre) return undefined;
  const n = norm(nombre);
  return (lista.find((x) => norm(x.nombre) === n) ?? lista.find((x) => norm(x.nombre).includes(n) || n.includes(norm(x.nombre))))?.id;
}

/**
 * POST /api/ai/parse { texto } → borrador de movimiento. NUNCA guarda nada:
 * el front precarga el formulario y la persona confirma.
 */
ai.post("/parse", async (c) => {
  const p = c.var.p;
  const { texto } = await cuerpo(c, aiParseInput);
  const ctx = await cargarContexto(p);
  const [categorias, cuentas, personas] = await Promise.all([
    p.categoria.findMany({ where: { archivada: false }, include: { padre: { select: { nombre: true } } } }),
    p.cuenta.findMany({ where: { archivada: false } }),
    p.persona.findMany(),
  ]);
  const yo = personas.find((x) => x.id === c.var.sesion.personaId);

  const system = [
    "Convertís frases cortas de finanzas personales (español rioplatense) en UN movimiento en JSON.",
    `Hoy es ${ctx.hoy}. Quien escribe es ${yo?.nombre ?? "el usuario"}.`,
    "Respondé SOLO un objeto JSON con estas claves (omití las que no sepas):",
    '{"tipo":"gasto|ingreso|transferencia","monto":"45000.50","moneda":"ARS|USD","fecha":"AAAA-MM-DD","categoria":"<nombre exacto>","cuenta":"<nombre exacto>","cuentaDestino":"<nombre exacto, solo transferencias>","dueno":"<nombre exacto>","ambito":"personal|compartido|negocio|familia","etiquetas":["..."],"nota":"texto corto","cuotas":3}',
    "Montos: \"45 mil\" = 45000, \"1,5 palos\" = 1500000, \"45.000\" = 45000. Sin separador de miles en la respuesta.",
    "\"ayer\", \"el viernes\", etc. se resuelven respecto de hoy. Si no hay fecha, omitila.",
    "Usá SOLO nombres de estas listas (si nada encaja, omití la clave):",
    `Categorías: ${categorias.map((x) => (x.padre ? `${x.nombre} (${x.padre.nombre}, ${x.tipo})` : `${x.nombre} (${x.tipo})`)).join("; ")}`,
    `Cuentas: ${cuentas.map((x) => x.nombre).join("; ")}`,
    `Personas: ${personas.map((x) => x.nombre).join("; ")}`,
  ].join("\n");

  const r = respuesta.parse(extraerJson(await completar({ system, user: texto })));
  const monto = r.monto?.replace(/[^\d.]/g, "");
  const etiquetas = r.etiquetas?.map((e) => e.trim().toLowerCase()).filter((e) => e && e.length <= 30).slice(0, 10);

  const borrador: AiParseDTO["borrador"] = {
    tipo: r.tipo,
    monto: monto && /^\d+(\.\d{1,2})?$/.test(monto) && Number(monto) > 0 ? monto : undefined,
    moneda: r.moneda,
    fechaConsumo: r.fecha && esFecha(r.fecha) ? r.fecha : undefined,
    categoriaId: buscar(categorias, r.categoria),
    cuentaId: buscar(cuentas, r.cuenta),
    cuentaDestinoId: r.tipo === "transferencia" ? buscar(cuentas, r.cuentaDestino) : undefined,
    duenoId: buscar(personas, r.dueno),
    ambito: r.ambito ?? undefined,
    etiquetas: etiquetas?.length ? etiquetas : undefined,
    nota: r.nota?.slice(0, 200) || undefined,
    cuotas: r.cuotas ?? undefined,
  };
  // Sin claves undefined en la respuesta.
  return c.json({ borrador: Object.fromEntries(Object.entries(borrador).filter(([, v]) => v !== undefined)) } satisfies AiParseDTO);
});

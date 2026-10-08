/** Prompt y schema de la carga por texto libre: los comparten la ruta /ai/parse y el benchmark. */
import { z } from "zod";

/** Lo que se le pide a la IA. Permisivo: un campo raro se descarta, no invalida la respuesta. */
export const respuestaIa = z.object({
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

export interface ListasIa {
  hoy: string;
  yo?: string;
  categorias: { nombre: string; tipo: string; padre?: string }[];
  cuentas: string[];
  personas: string[];
}

export function promptClasificacion(l: ListasIa): string {
  return [
    "Convertís frases cortas de finanzas personales (español rioplatense) en UN movimiento en JSON.",
    `Hoy es ${l.hoy}. Quien escribe es ${l.yo ?? "el usuario"}.`,
    "Respondé SOLO un objeto JSON con estas claves (omití las que no sepas):",
    '{"tipo":"gasto|ingreso|transferencia","monto":"45000.50","moneda":"ARS|USD","fecha":"AAAA-MM-DD","categoria":"<nombre exacto>","cuenta":"<nombre exacto>","cuentaDestino":"<nombre exacto, solo transferencias>","dueno":"<nombre exacto>","ambito":"personal|compartido|negocio|familia","etiquetas":["..."],"nota":"texto corto","cuotas":3}',
    "Montos: \"45 mil\" = 45000, \"1,5 palos\" = 1500000, \"45.000\" = 45000. Sin separador de miles en la respuesta.",
    "Cuotas: \"monto\" es el de CADA cuota. \"12 cuotas de 85 mil\" = monto 85000, cuotas 12. Si solo dicen el total (\"1,2 palos en 12 cuotas\"), dividilo por la cantidad de cuotas.",
    "\"ayer\", \"el viernes\", etc. se resuelven respecto de hoy. Si no hay fecha, omitila.",
    "\"dueno\" es la persona a la que corresponde el gasto o ingreso: si la frase la nombra (\"lo pagó Leo\", \"para Leo\", \"el de Leo\"), usala; si no, omití la clave. La tarjeta o cuenta de alguien indica la cuenta, no el dueño.",
    "Usá SOLO nombres de estas listas (si nada encaja, omití la clave):",
    `Categorías: ${l.categorias.map((x) => (x.padre ? `${x.nombre} (${x.padre}, ${x.tipo})` : `${x.nombre} (${x.tipo})`)).join("; ")}`,
    `Cuentas: ${l.cuentas.join("; ")}`,
    `Personas: ${l.personas.join("; ")}`,
  ].join("\n");
}

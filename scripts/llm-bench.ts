/**
 * Compara proveedores de IA con frases de carga: `npm run llm:bench [archivo-de-frases]`.
 * Corre cada frase contra cada proveedor y modelo configurado (sin fallback) con el prompt real e
 * imprime latencia, tokens y si el JSON fue válido. Las listas salen de `BENCH_HOGAR`, o de
 * seed/household.local.json (o del ejemplo, que es el que usan las frases de muestra). Los modelos
 * corren en paralelo y las frases de cada uno en serie, con `BENCH_PAUSA_MS` entre una y otra (el
 * free tier de Groq limita tokens por minuto y por modelo).
 */
import { existsSync, readFileSync } from "node:fs";
import { llamar, proveedores, type Llamada } from "../server/llm.js";
import { promptClasificacion, respuestaIa } from "../server/services/clasificacion.js";
import { validarHousehold } from "../server/services/seed.js";
import { hoy } from "../shared/domain/fechas.js";

process.env.LLM_LOG = "false"; // la tabla ya muestra todo

const frases = readFileSync(process.argv[2] ?? "scripts/llm-frases.txt", "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));
const archivoHogar = process.env.BENCH_HOGAR || (existsSync("seed/household.local.json") ? "seed/household.local.json" : "seed/household.example.json");
const h = validarHousehold(JSON.parse(readFileSync(archivoHogar, "utf8")));
const system = promptClasificacion({
  hoy: hoy(),
  yo: h.personas[0].nombre,
  categorias: h.categorias.flatMap((c) => [{ nombre: c.nombre, tipo: c.tipo }, ...c.subcategorias.map((s) => ({ nombre: s.nombre, tipo: c.tipo, padre: c.nombre }))]),
  cuentas: h.cuentas.map((c) => c.nombre),
  personas: h.personas.map((p) => p.nombre),
});

const cadena = proveedores();
if (!cadena.length) {
  console.error("No hay proveedores configurados: definí GROQ_API_KEY y/o OPENROUTER_API_KEY (o LLM_API_KEY + LLM_MODEL) en .env");
  process.exit(1);
}
console.log(`${frases.length} frases · hogar: ${archivoHogar} · proveedores: ${cadena.map((p) => `${p.nombre} (${p.modelos.join(", ")})`).join(" → ")}\n`);

const pausaMs = Number(process.env.BENCH_PAUSA_MS ?? 0);
const promedio = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : "-");
const corridas = cadena.flatMap((prov) => prov.modelos.map((modelo) => ({ prov, modelo })));

const resultados = await Promise.all(
  corridas.map(async ({ prov, modelo }) => {
    const ls: Llamada[] = [];
    for (const [i, frase] of frases.entries()) {
      if (i && pausaMs) await new Promise((r) => setTimeout(r, pausaMs));
      ls.push(await llamar(prov, modelo, { system, user: frase, schema: respuestaIa }));
    }
    return ls;
  }),
);

const detalle: Record<string, unknown>[] = [];
const resumen: Record<string, unknown>[] = [];
for (const [k, { prov, modelo }] of corridas.entries()) {
  const ls = resultados[k];
  for (const [i, l] of ls.entries()) {
    const frase = frases[i];
    const r = l.json as { tipo?: string; monto?: string; categoria?: string | null; dueno?: string | null; cuotas?: number | null } | undefined;
    detalle.push({
      proveedor: prov.nombre,
      modelo,
      frase: frase.length > 38 ? `${frase.slice(0, 37)}…` : frase,
      ms: l.ms,
      tokens: l.tokens?.total ?? "-",
      json: r ? "✓" : `✗ ${l.error}`,
      resultado: r ? `${r.tipo} ${r.monto ?? "?"}${r.cuotas ? ` en ${r.cuotas}` : ""} · ${r.categoria ?? "-"} · ${r.dueno ?? "-"}` : "",
    });
  }
  const ms = ls.map((l) => l.ms).sort((a, b) => a - b);
  const tokens = ls.flatMap((l) => (l.tokens ? [l.tokens.total] : []));
  resumen.push({
    proveedor: prov.nombre,
    modelo,
    "ms prom": promedio(ms),
    "ms p50": ms[Math.floor(ms.length / 2)],
    "ms máx": ms.at(-1),
    "tokens total": tokens.reduce((a, b) => a + b, 0),
    "tokens prom": promedio(tokens),
    "JSON válido": `${ls.filter((l) => l.json !== undefined).length}/${ls.length}`,
  });
}
console.table(detalle);
console.table(resumen);

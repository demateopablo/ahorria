/**
 * Cliente mínimo para endpoints compatibles con OpenAI (`POST /chat/completions`) con una cadena
 * de proveedores: si uno falla (sin key, rate limit, error, JSON inválido) se pasa al siguiente.
 * El orden sale de `LLM_PROVIDER` (ej. "groq,openrouter"); sin definir: groq → openrouter → custom.
 * `custom` es el de siempre (`LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`): OpenAI, Claude, Ollama…
 */
import type { ZodType } from "zod";
import { HttpError } from "./http.js";

export type NombreProveedor = "groq" | "openrouter" | "custom";

export interface Proveedor {
  nombre: NombreProveedor;
  baseUrl: string;
  apiKey: string;
  /** El primero es el principal; el resto se prueba en orden si falla. */
  modelos: string[];
  /** Pedidos como máximo antes de pasar al siguiente proveedor. */
  intentos: number;
  timeoutMs: number;
}

const NOMBRES: NombreProveedor[] = ["groq", "openrouter", "custom"];

const lista = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

/** Arma un proveedor desde el entorno; undefined si le falta la key o el modelo. */
function leerProveedor(nombre: NombreProveedor): Proveedor | undefined {
  const env = process.env;
  const p =
    nombre === "groq"
      ? // Rápido: un intento por modelo y, si falla, al siguiente proveedor.
        { baseUrl: "https://api.groq.com/openai/v1", apiKey: env.GROQ_API_KEY, modelos: lista(env.GROQ_MODEL || "openai/gpt-oss-20b"), intentos: 1, timeoutMs: 8000 }
      : nombre === "openrouter"
        ? // Con `openrouter/free` cada intento cae en otro modelo: vale reintentar.
          { baseUrl: "https://openrouter.ai/api/v1", apiKey: env.OPENROUTER_API_KEY, modelos: lista(env.OPENROUTER_MODEL || "openrouter/free"), intentos: 3, timeoutMs: 15000 }
        : { baseUrl: (env.LLM_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, ""), apiKey: env.LLM_API_KEY, modelos: lista(env.LLM_MODEL), intentos: 3, timeoutMs: 15000 };
  if (!p.apiKey || !p.modelos.length) return undefined;
  return { ...p, nombre, apiKey: p.apiKey, intentos: Math.max(p.intentos, p.modelos.length) };
}

const esNombre = (n: string): n is NombreProveedor => (NOMBRES as string[]).includes(n);

/** Proveedores con key, en el orden de `LLM_PROVIDER`. Vacío = IA deshabilitada. */
export function proveedores(): Proveedor[] {
  const pedidos = lista(process.env.LLM_PROVIDER?.toLowerCase());
  const desconocidos = pedidos.filter((n) => !esNombre(n));
  if (desconocidos.length) console.warn(`[llm] LLM_PROVIDER: se ignora ${desconocidos.join(", ")} (válidos: ${NOMBRES.join(", ")})`);
  const orden = pedidos.length ? [...new Set(pedidos.filter(esNombre))] : NOMBRES;
  return orden.map(leerProveedor).filter((p) => p !== undefined);
}

export interface Llamada {
  proveedor: NombreProveedor;
  modelo: string;
  ms: number;
  status?: number;
  tokens?: { entrada: number; salida: number; total: number };
  /** JSON parseado (y validado, si se pasó schema). undefined si falló. */
  json?: unknown;
  /** Por qué falló: "http 429", "timeout", "red", "sin JSON", "schema". */
  error?: string;
}

/** Un solo pedido a un proveedor y modelo, sin reintentos ni fallback (lo usa también el benchmark). */
export async function llamar(prov: Proveedor, modelo: string, opts: { system: string; user: string; schema?: ZodType; timeoutMs?: number }): Promise<Llamada> {
  const inicio = performance.now();
  const fin = (r: Partial<Llamada>): Llamada => {
    const l: Llamada = { proveedor: prov.nombre, modelo, ms: Math.round(performance.now() - inicio), ...r };
    logLlamada(l);
    return l;
  };
  let res: Response;
  try {
    res = await fetch(`${prov.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${prov.apiKey}`,
        // Cabecera opcional de OpenRouter (otros proveedores la ignoran).
        "x-title": "Ahorria",
      },
      body: JSON.stringify({
        model: modelo,
        temperature: 0,
        // Margen para modelos que "razonan" antes de responder.
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? prov.timeoutMs),
    });
  } catch (e) {
    return fin({ error: e instanceof Error && e.name === "TimeoutError" ? "timeout" : "red" });
  }
  if (!res.ok) {
    // Solo el código del proveedor (ej. "json_validate_failed", "model_not_found"), nunca el texto.
    const err = (await res.json().catch(() => null)) as { error?: { code?: string; type?: string } } | null;
    const codigo = err?.error?.code ?? err?.error?.type;
    return fin({ status: res.status, error: `http ${res.status}${codigo ? ` ${codigo}` : ""}` });
  }
  const data = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  } | null;
  const u = data?.usage;
  const tokens = u ? { entrada: u.prompt_tokens ?? 0, salida: u.completion_tokens ?? 0, total: u.total_tokens ?? 0 } : undefined;
  const texto = data?.choices?.[0]?.message?.content;
  const crudo = texto ? extraerJson(texto) : undefined;
  if (crudo === undefined) return fin({ status: res.status, tokens, error: "sin JSON" });
  if (!opts.schema) return fin({ status: res.status, tokens, json: crudo });
  const r = opts.schema.safeParse(crudo);
  return r.success ? fin({ status: res.status, tokens, json: r.data }) : fin({ status: res.status, tokens, error: "schema" });
}

/** TEMPORAL: una línea por llamada para comparar proveedores (latencia y consumo). Nunca el texto. */
function logLlamada(l: Llamada) {
  if (process.env.LLM_LOG === "false") return;
  const { proveedor, modelo, ms, tokens, error } = l;
  console.info(
    `[llm] ${JSON.stringify({ proveedor, modelo, ms, tokens: tokens?.total ?? null, entrada: tokens?.entrada ?? null, salida: tokens?.salida ?? null, ok: l.json !== undefined, error })}`,
  );
}

const REINTENTABLES = new Set([400, 408, 429, 500, 502, 503, 504]);

const MENSAJES = {
  key: "La API key de IA no es válida o no tiene permisos. Revisá GROQ_API_KEY / OPENROUTER_API_KEY / LLM_API_KEY.",
  saldo: "La cuenta del proveedor de IA no tiene saldo para este modelo.",
  saturada: "La IA está saturada en este momento (los modelos gratis tienen cupo). Probá en un rato o cargalo a mano.",
  noEntendio: "La IA no pudo interpretarlo esta vez. Probá de nuevo o cargalo a mano.",
};

/**
 * Pide una respuesta en JSON, la valida con `schema` (si viene) y la devuelve. Recorre los
 * proveedores en orden; dentro de cada uno hace hasta `intentos` pedidos rotando sus modelos
 * (algunos devuelven vacío o texto sin JSON). Los errores llegan al usuario en castellano y solo
 * si fallaron todos.
 */
export async function completarJson<T = unknown>(opts: { system: string; user: string; schema?: ZodType<T>; timeoutMs?: number }): Promise<T> {
  const cadena = proveedores();
  if (!cadena.length) throw new HttpError(501, "La IA no está configurada (GROQ_API_KEY, OPENROUTER_API_KEY o LLM_API_KEY)");
  const fallas = new Set<keyof typeof MENSAJES>();
  for (const prov of cadena) {
    for (let i = 0; i < prov.intentos; i++) {
      const l = await llamar(prov, prov.modelos[i % prov.modelos.length], opts);
      if (l.json !== undefined) return l.json as T;
      if (l.status === 401 || l.status === 403) {
        fallas.add("key");
        break;
      }
      if (l.status === 402) {
        fallas.add("saldo");
        break;
      }
      if (l.status === 429) fallas.add("saturada");
      // Un error que no se arregla reintentando: siguiente proveedor.
      if (l.status && l.status >= 400 && !REINTENTABLES.has(l.status)) break;
    }
  }
  const motivo = (["key", "saldo", "saturada"] as const).find((m) => fallas.has(m)) ?? "noEntendio";
  throw new HttpError(motivo === "key" || motivo === "saldo" ? 502 : 503, MENSAJES[motivo]);
}

/** Extrae el primer objeto JSON de un texto (los modelos a veces lo envuelven en ```json). undefined si no hay. */
export function extraerJson(texto: string): unknown {
  const inicio = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (inicio < 0 || fin <= inicio) return undefined;
  try {
    return JSON.parse(texto.slice(inicio, fin + 1));
  } catch {
    return undefined;
  }
}

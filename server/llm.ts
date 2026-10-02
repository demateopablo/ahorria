/**
 * Cliente mínimo para cualquier endpoint compatible con OpenAI (`POST /chat/completions`):
 * OpenRouter, OpenAI, Groq, Together, Ollama, etc. Cambiar de proveedor es cambiar
 * `LLM_BASE_URL`, `LLM_API_KEY` y `LLM_MODEL`.
 */
import { HttpError } from "./http.js";

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  /** El primero es el principal; el resto se prueba en orden si falla. */
  modelos: string[];
}

export function configLlm(): LlmConfig {
  const baseUrl = (process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  const apiKey = process.env.LLM_API_KEY;
  const modelos = (process.env.LLM_MODEL ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (!apiKey || !modelos.length) throw new HttpError(501, "La IA no está configurada (LLM_API_KEY / LLM_MODEL)");
  return { baseUrl, apiKey, modelos };
}

const REINTENTABLES = new Set([408, 429, 500, 502, 503, 504]);

const MENSAJES = {
  key: "La API key de IA no es válida o no tiene permisos. Revisá LLM_API_KEY.",
  saldo: "La cuenta del proveedor de IA no tiene saldo para este modelo.",
  saturada: "La IA está saturada en este momento (los modelos gratis tienen cupo). Probá en un rato o cargalo a mano.",
  noEntendio: "La IA no pudo interpretarlo esta vez. Probá de nuevo o cargalo a mano.",
};

/**
 * Pide una respuesta en JSON y la devuelve ya parseada. Hace hasta `intentos` pedidos, rotando
 * los modelos configurados: con routers como `openrouter/free` cada intento cae en otro modelo, y
 * algunos devuelven vacío o texto sin JSON. Los errores llegan al usuario en castellano.
 */
export async function completarJson(opts: { system: string; user: string; intentos?: number; timeoutMs?: number }): Promise<unknown> {
  const cfg = configLlm();
  const intentos = opts.intentos ?? 3;
  let saturada = false;
  for (let i = 0; i < intentos; i++) {
    const modelo = cfg.modelos[i % cfg.modelos.length];
    let res: Response;
    try {
      res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${cfg.apiKey}`,
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
        signal: AbortSignal.timeout(opts.timeoutMs ?? 15000),
      });
    } catch {
      continue; // timeout o red: siguiente intento
    }
    if (res.status === 401 || res.status === 403) throw new HttpError(502, MENSAJES.key);
    if (res.status === 402) throw new HttpError(502, MENSAJES.saldo);
    if (!res.ok) {
      if (res.status === 429) saturada = true;
      if (REINTENTABLES.has(res.status) || res.status === 400) continue;
      throw new HttpError(502, MENSAJES.noEntendio);
    }
    const data = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
    const texto = data?.choices?.[0]?.message?.content;
    const json = texto ? extraerJson(texto) : undefined;
    if (json !== undefined) return json;
  }
  throw new HttpError(503, saturada ? MENSAJES.saturada : MENSAJES.noEntendio);
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

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

/** Pide una respuesta y devuelve el texto. Prueba los modelos en orden ante errores transitorios. */
export async function completar(opts: { system: string; user: string; maxTokens?: number; timeoutMs?: number }): Promise<string> {
  const cfg = configLlm();
  let ultimoError = "sin respuesta";
  for (const modelo of cfg.modelos) {
    let res: Response;
    try {
      res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${cfg.apiKey}`,
          // Cabeceras opcionales de OpenRouter (otros proveedores las ignoran).
          "x-title": "Ahorria",
        },
        body: JSON.stringify({
          model: modelo,
          temperature: 0,
          max_tokens: opts.maxTokens ?? 400,
          messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.user },
          ],
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 20000),
      });
    } catch (e) {
      ultimoError = e instanceof Error ? e.message : String(e);
      continue;
    }
    if (!res.ok) {
      ultimoError = `HTTP ${res.status}`;
      if (REINTENTABLES.has(res.status)) continue;
      throw new HttpError(502, `El proveedor de IA respondió ${res.status}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const texto = data.choices?.[0]?.message?.content;
    if (texto) return texto;
    ultimoError = "respuesta vacía";
  }
  throw new HttpError(502, `La IA no respondió (${ultimoError})`);
}

/** Extrae el primer objeto JSON de un texto (los modelos a veces lo envuelven en ```json). */
export function extraerJson(texto: string): unknown {
  const inicio = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (inicio < 0 || fin <= inicio) throw new HttpError(502, "La IA no devolvió JSON");
  try {
    return JSON.parse(texto.slice(inicio, fin + 1));
  } catch {
    throw new HttpError(502, "La IA devolvió JSON inválido");
  }
}

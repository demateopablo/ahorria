import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { completarJson } from "./llm.js";

const ok = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }));
const status = (s: number) => new Response("{}", { status: s });

/** Mockea fetch con respuestas en orden; devuelve a qué proveedor fue cada pedido. */
function fetchQue(...respuestas: (Response | Error)[]) {
  const f = vi.fn(async (_url: string | URL | Request) => {
    const r = respuestas.shift();
    if (!r || r instanceof Error) throw r ?? new Error("sin más respuestas");
    return r;
  });
  vi.stubGlobal("fetch", f);
  return () => f.mock.calls.map(([u]) => (String(u).includes("groq") ? "groq" : "openrouter"));
}

const args = { system: "s", user: "u", schema: z.object({ tipo: z.string() }) };

describe("completarJson: cadena de proveedores", () => {
  beforeEach(() => {
    for (const v of ["LLM_API_KEY", "LLM_MODEL", "GROQ_MODEL", "OPENROUTER_MODEL"]) vi.stubEnv(v, "");
    vi.stubEnv("LLM_LOG", "false");
    vi.stubEnv("LLM_PROVIDER", "groq,openrouter");
    vi.stubEnv("GROQ_API_KEY", "g");
    vi.stubEnv("OPENROUTER_API_KEY", "o");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("usa Groq si responde bien", async () => {
    const llamadas = fetchQue(ok('{"tipo":"gasto"}'));
    expect(await completarJson(args)).toEqual({ tipo: "gasto" });
    expect(llamadas()).toEqual(["groq"]);
  });

  it("rate limit en Groq → OpenRouter", async () => {
    const llamadas = fetchQue(status(429), ok('{"tipo":"gasto"}'));
    expect(await completarJson(args)).toEqual({ tipo: "gasto" });
    expect(llamadas()).toEqual(["groq", "openrouter"]);
  });

  it("JSON mal formado o que no pasa el schema → siguiente proveedor", async () => {
    const llamadas = fetchQue(ok("no sé"), ok('{"otra":1}'), ok('{"tipo":"ingreso"}'));
    expect(await completarJson(args)).toEqual({ tipo: "ingreso" });
    expect(llamadas()).toEqual(["groq", "openrouter", "openrouter"]);
  });

  it("timeout o red en Groq → OpenRouter", async () => {
    fetchQue(new Error("red"), ok('{"tipo":"gasto"}'));
    expect(await completarJson(args)).toEqual({ tipo: "gasto" });
  });

  it("sin GROQ_API_KEY va directo a OpenRouter", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const llamadas = fetchQue(ok('{"tipo":"gasto"}'));
    await completarJson(args);
    expect(llamadas()).toEqual(["openrouter"]);
  });

  it("respeta el orden de LLM_PROVIDER", async () => {
    vi.stubEnv("LLM_PROVIDER", "openrouter,groq");
    const llamadas = fetchQue(status(401), ok('{"tipo":"gasto"}'));
    await completarJson(args);
    expect(llamadas()).toEqual(["openrouter", "groq"]);
  });

  it("si fallan todos, avisa en castellano; sin ninguno configurado, 501", async () => {
    fetchQue(status(429), status(429), status(429), status(429));
    await expect(completarJson(args)).rejects.toMatchObject({ status: 503, message: expect.stringContaining("saturada") });
    vi.stubEnv("GROQ_API_KEY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    await expect(completarJson(args)).rejects.toMatchObject({ status: 501 });
  });
});

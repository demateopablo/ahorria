import type { Context } from "hono";
import type { z } from "zod";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Defensa CSRF para escrituras: el Origin del navegador tiene que coincidir con el host que sirve
 * la app. La cookie ya es SameSite=Lax; esto suma una capa.
 */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new HttpError(403, "Origen no permitido");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "Origen no permitido");
  }
  if (originHost !== host) throw new HttpError(403, "Origen no permitido");
}

export async function leerJson(c: Context): Promise<unknown> {
  if (!c.req.header("content-type")?.includes("application/json")) throw new HttpError(415, "Se esperaba JSON");
  try {
    return await c.req.json();
  } catch {
    throw new HttpError(400, "JSON inválido");
  }
}

/** Valida con zod y devuelve un 400 con el primer error legible. */
export function validar<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const issue = r.error.issues[0];
  const campo = issue.path.length ? `${issue.path.join(".")}: ` : "";
  throw new HttpError(400, `${campo}${issue.message}`);
}

export async function cuerpo<S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> {
  return validar(schema, await leerJson(c));
}

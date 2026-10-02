import { Hono } from "hono";
import { z } from "zod";
import { verificarTokenGoogle } from "../auth/google.js";
import { borrarCookieSesion, crearCookieSesion, leerSesion } from "../auth/session.js";
import { personaDTO } from "../dto.js";
import { devLoginHabilitado } from "../env.js";
import { assertSameOrigin, cuerpo, HttpError } from "../http.js";
import type { AppEnv } from "../tipos-hono.js";

export const auth = new Hono<AppEnv>();

/** POST /api/auth/login { credential } — ID token de Google; el email tiene que ser el de una Persona. */
auth.post("/login", async (c) => {
  assertSameOrigin(c.req.raw);
  const { credential } = await cuerpo(c, z.object({ credential: z.string().min(10) }));
  const email = await verificarTokenGoogle(credential);
  const persona = await c.var.p.persona.findUnique({ where: { email } });
  if (!persona) throw new HttpError(403, `La cuenta ${email} no tiene acceso a este hogar`);
  c.header("set-cookie", await crearCookieSesion({ personaId: persona.id, email }));
  return c.json({ persona: personaDTO(persona) });
});

/** Opciones de login disponibles (para que el front sepa si mostrar el acceso de desarrollo). */
auth.get("/opciones", async (c) => {
  const dev = devLoginHabilitado();
  const personas = dev ? await c.var.p.persona.findMany({ where: { email: { not: null } }, orderBy: { orden: "asc" } }) : [];
  return c.json({ google: Boolean(process.env.GOOGLE_CLIENT_ID), dev, personas: personas.map(personaDTO) });
});

/** POST /api/auth/dev-login { personaId } — SOLO local (ALLOW_DEV_LOGIN=true y fuera de Vercel). */
auth.post("/dev-login", async (c) => {
  if (!devLoginHabilitado()) throw new HttpError(404, "No encontrado");
  assertSameOrigin(c.req.raw);
  const { personaId } = await cuerpo(c, z.object({ personaId: z.string() }));
  const persona = await c.var.p.persona.findUnique({ where: { id: personaId } });
  if (!persona?.email) throw new HttpError(403, "Esa persona no tiene acceso");
  c.header("set-cookie", await crearCookieSesion({ personaId: persona.id, email: persona.email }));
  return c.json({ persona: personaDTO(persona) });
});

auth.post("/logout", (c) => {
  assertSameOrigin(c.req.raw);
  c.header("set-cookie", borrarCookieSesion());
  return c.json({ ok: true });
});

auth.get("/me", async (c) => {
  const sesion = await leerSesion(c.req.header("cookie"));
  if (!sesion) throw new HttpError(401, "Sin sesión");
  const persona = await c.var.p.persona.findUnique({ where: { id: sesion.personaId } });
  if (!persona || persona.email !== sesion.email) throw new HttpError(401, "Sin sesión");
  return c.json({ persona: personaDTO(persona) });
});

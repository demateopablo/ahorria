import { Hono } from "hono";
import { leerSesion } from "./auth/session.js";
import { db, type PrismaClient } from "./db.js";
import { assertSameOrigin, HttpError } from "./http.js";
import { ai } from "./routes/ai.js";
import { auth } from "./routes/auth.js";
import { catalogo } from "./routes/catalogo.js";
import { movimientos, pendientes } from "./routes/movimientos.js";
import { analisis, cuotas, recurrencias } from "./routes/planificacion.js";
import type { AppEnv } from "./tipos-hono.js";

const PUBLICAS = new Set(["/api/auth/login", "/api/auth/dev-login", "/api/auth/logout", "/api/auth/me", "/api/auth/opciones", "/api/health"]);

/** App Hono con toda la API bajo /api. `prisma` se inyecta en tests. */
export function crearApp(prisma: () => PrismaClient = db) {
  const app = new Hono<AppEnv>().basePath("/api");

  app.use("*", async (c, next) => {
    c.set("p", prisma());
    c.header("cache-control", "no-store");
    if (PUBLICAS.has(c.req.path)) return next();

    const sesion = await leerSesion(c.req.header("cookie"));
    if (!sesion) throw new HttpError(401, "Tenés que iniciar sesión");
    // La persona tiene que seguir existiendo con el mismo email (si la sacan del hogar, pierde acceso).
    const persona = await c.var.p.persona.findUnique({ where: { id: sesion.personaId }, select: { email: true } });
    if (!persona || persona.email !== sesion.email) throw new HttpError(401, "Tenés que iniciar sesión");
    c.set("sesion", sesion);

    if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) assertSameOrigin(c.req.raw);
    return next();
  });

  /** Estado de la API y de la conexión a la base (sin datos: solo si responde). */
  app.get("/health", async (c) => {
    try {
      await c.var.p.$queryRaw`SELECT 1`;
      return c.json({ ok: true, db: true });
    } catch {
      return c.json({ ok: false, db: false }, 503);
    }
  });
  app.route("/auth", auth);
  app.route("/", catalogo);
  app.route("/movimientos", movimientos);
  app.route("/pendientes", pendientes);
  app.route("/recurrencias", recurrencias);
  app.route("/cuotas", cuotas);
  app.route("/", analisis);
  app.route("/ai", ai);

  app.notFound((c) => c.json({ error: "No encontrado" }, 404));
  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status as 400);
    console.error(err);
    return c.json({ error: "Error interno" }, 500);
  });

  return app;
}

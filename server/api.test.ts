/**
 * Tests de integración de la API contra un Postgres real (TEST_DATABASE_URL).
 * Local: `npm run db:up` (crea la base ahorria_test). Sin TEST_DATABASE_URL se saltean.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sumarMeses } from "../shared/domain/fechas.js";
import type { BootstrapDTO, DashboardDTO, MovimientoDTO, ProyeccionDTO } from "../shared/schemas/api.js";
import { crearApp } from "./app.js";
import { crearCookieSesion } from "./auth/session.js";
import { PrismaClient } from "./generated/prisma/client.js";
import { cargarContexto } from "./services/contexto.js";
import { cargarHousehold, vaciarBase, validarHousehold } from "./services/seed.js";

const URL_TEST = process.env.TEST_DATABASE_URL;

describe.skipIf(!URL_TEST)("API", () => {
  let p: PrismaClient;
  let app: ReturnType<typeof crearApp>;
  let hoy: string;
  const ids: Record<string, string> = {};
  const cookies: Record<string, string> = {};

  beforeAll(async () => {
    process.env.SESSION_SECRET ||= "secreto-de-tests-secreto-de-tests";
    process.env.LLM_API_KEY = "";
    process.env.GROQ_API_KEY = "";
    process.env.OPENROUTER_API_KEY = "";
    execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: URL_TEST }, stdio: "ignore" });
    p = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL_TEST! }) });
    await vaciarBase(p);
    const h = validarHousehold(JSON.parse(readFileSync("seed/household.example.json", "utf8")));
    await cargarHousehold(p, h, new Date().toISOString().slice(0, 10));
    app = crearApp(() => p);
    hoy = (await cargarContexto(p)).hoy;

    for (const x of await p.persona.findMany()) ids[x.nombre] = x.id;
    for (const x of await p.cuenta.findMany()) ids[x.nombre] = x.id;
    for (const x of await p.categoria.findMany()) ids[x.nombre] = x.id;
    cookies.ana = (await crearCookieSesion({ personaId: ids.Ana, email: "ana@example.com" })).split(";")[0];
    cookies.leo = (await crearCookieSesion({ personaId: ids.Leo, email: "leo@example.com" })).split(";")[0];
  }, 60000);

  afterAll(async () => {
    await p?.$disconnect();
  });

  const req = (method: string, path: string, opts: { quien?: "ana" | "leo" | null; body?: unknown; origin?: string | null } = {}) => {
    const headers: Record<string, string> = { host: "ahorria.test" };
    const quien = opts.quien === undefined ? "ana" : opts.quien;
    if (quien) headers.cookie = cookies[quien];
    const origin = opts.origin === undefined ? "https://ahorria.test" : opts.origin;
    if (origin) headers.origin = origin;
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    return app.request(`/api${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  };
  const json = async <T>(r: Response | Promise<Response>) => (await (await r).json()) as T;

  describe("seguridad", () => {
    it("sin cookie → 401 en toda la API privada", async () => {
      for (const path of ["/bootstrap", "/movimientos", "/proyeccion", "/dashboard", "/recurrencias", "/cuotas", "/pendientes"]) {
        expect((await req("GET", path, { quien: null })).status, path).toBe(401);
      }
      expect((await req("POST", "/movimientos", { quien: null, body: {} })).status).toBe(401);
    });

    it("una cookie inválida o de alguien sin acceso → 401", async () => {
      const r = await app.request("/api/bootstrap", { headers: { cookie: "ahorria_session=basura" } });
      expect(r.status).toBe(401);
      const fantasma = (await crearCookieSesion({ personaId: ids.Ana, email: "otra@example.com" })).split(";")[0];
      expect((await app.request("/api/bootstrap", { headers: { cookie: fantasma } })).status).toBe(401);
    });

    it("una escritura sin Origin o de otro sitio → 403", async () => {
      const body = { tipo: "gasto", monto: "100", fechaConsumo: hoy, cuentaId: ids["Efectivo"] };
      expect((await req("POST", "/movimientos", { body, origin: null })).status).toBe(403);
      expect((await req("POST", "/movimientos", { body, origin: "https://malo.example" })).status).toBe(403);
    });

    it("el login de desarrollo solo existe si está habilitado (y nunca en Vercel)", async () => {
      const antes = { dev: process.env.ALLOW_DEV_LOGIN, vercel: process.env.VERCEL };
      try {
        process.env.ALLOW_DEV_LOGIN = "false";
        expect((await req("POST", "/auth/dev-login", { quien: null, body: { personaId: ids.Ana } })).status).toBe(404);
        process.env.ALLOW_DEV_LOGIN = "true";
        process.env.VERCEL = "1";
        expect((await req("POST", "/auth/dev-login", { quien: null, body: { personaId: ids.Ana } })).status).toBe(404);
        delete process.env.VERCEL;
        const ok = await req("POST", "/auth/dev-login", { quien: null, body: { personaId: ids.Ana } });
        expect(ok.status).toBe(200);
        expect(ok.headers.get("set-cookie")).toMatch(/HttpOnly; Secure; SameSite=Lax/);
      } finally {
        process.env.ALLOW_DEV_LOGIN = antes.dev;
        if (antes.vercel === undefined) delete process.env.VERCEL;
        else process.env.VERCEL = antes.vercel;
      }
    });

    it("/auth/me devuelve a la persona logueada (o null sin sesión)", async () => {
      const r = await json<{ persona: { nombre: string } }>(req("GET", "/auth/me"));
      expect(r.persona.nombre).toBe("Ana");
      const sin = await req("GET", "/auth/me", { quien: null });
      expect(sin.status).toBe(200);
      expect(((await sin.json()) as { persona: null }).persona).toBeNull();
    });
  });

  describe("bootstrap y pendientes", () => {
    it("trae todo y genera los pendientes del mes", async () => {
      const b = await json<BootstrapDTO>(req("GET", "/bootstrap"));
      expect(b.yo.nombre).toBe("Ana");
      expect(b.personas).toHaveLength(2);
      expect(b.categorias.length).toBeGreaterThan(10);
      expect(b.pendientes).toBeGreaterThan(5);
      expect(b.ia).toBe(false);
      // idempotente
      const b2 = await json<BootstrapDTO>(req("GET", "/bootstrap"));
      expect(b2.pendientes).toBe(b.pendientes);
    });

    it("confirma un pendiente con el monto real", async () => {
      const { movimientos } = await json<{ movimientos: MovimientoDTO[] }>(req("GET", "/pendientes"));
      const alquiler = movimientos.find((m) => m.concepto === "Alquiler")!;
      const r = await json<{ movimiento: MovimientoDTO }>(req("POST", `/pendientes/${alquiler.id}/confirmar`, { body: { monto: "560000" } }));
      expect(r.movimiento).toMatchObject({ estado: "confirmado", monto: "560000", duenoId: ids.Ana });
      expect((await req("POST", `/pendientes/${alquiler.id}/confirmar`, { body: {} })).status).toBe(404);
    });

    it("una recurrencia 'de quien pague' queda a nombre de quien confirma", async () => {
      const { movimientos } = await json<{ movimientos: MovimientoDTO[] }>(req("GET", "/pendientes"));
      expect(movimientos.some((m) => m.concepto === "Verdulería")).toBe(false); // variable: sin pendientes
      const perro = movimientos.find((m) => m.concepto === "Comida del perro")!;
      const r = await json<{ movimiento: MovimientoDTO }>(req("POST", `/pendientes/${perro.id}/confirmar`, { quien: "leo", body: {} }));
      expect(r.movimiento.duenoId).toBe(ids.Leo);
    });

    it("omitir un pendiente lo saca de la lista", async () => {
      const { movimientos } = await json<{ movimientos: MovimientoDTO[] }>(req("GET", "/pendientes"));
      const luz = movimientos.find((m) => m.concepto === "Luz")!;
      expect((await req("POST", `/pendientes/${luz.id}/omitir`)).status).toBe(200);
      const despues = await json<{ movimientos: MovimientoDTO[] }>(req("GET", "/pendientes"));
      expect(despues.movimientos.some((m) => m.id === luz.id)).toBe(false);
    });

    it("confirmar con la fecha real de otro mes mueve el período y deja pendiente el que liberó", async () => {
      const mes = hoy.slice(0, 7);
      const anterior = sumarMeses(mes, -1);
      const { movimientos } = await json<{ movimientos: MovimientoDTO[] }>(req("GET", "/pendientes"));
      const seguro = movimientos.find((m) => m.concepto === "Seguro del auto")!;
      expect(seguro.periodo).toBe(mes);

      const r = await json<{ movimiento: MovimientoDTO }>(req("POST", `/pendientes/${seguro.id}/confirmar`, { body: { fechaConsumo: `${anterior}-14` } }));
      expect(r.movimiento).toMatchObject({ estado: "confirmado", periodo: anterior });
      const despues = await json<{ movimientos: MovimientoDTO[] }>(req("GET", "/pendientes"));
      const nuevo = despues.movimientos.filter((m) => m.concepto === "Seguro del auto");
      expect(nuevo.map((m) => m.periodo)).toEqual([mes]);

      // La proyección no lo cuenta dos veces: a lo sumo una línea del seguro por mes.
      const proy = await json<ProyeccionDTO>(req("GET", "/proyeccion?meses=4"));
      for (const m of proy.meses) expect(m.lineas.filter((l) => l.concepto === "Seguro del auto").length, m.mes).toBeLessThanOrEqual(1);

      // Deshacer: vuelve a ser el pendiente de este mes y reemplaza al regenerado.
      const back = await json<{ movimiento: MovimientoDTO }>(
        req("POST", `/pendientes/${seguro.id}/reabrir`, { body: { monto: seguro.monto, fechaConsumo: seguro.fechaConsumo } }),
      );
      expect(back.movimiento).toMatchObject({ id: seguro.id, estado: "pendiente", periodo: mes, fechaConsumo: seguro.fechaConsumo });
      const final = await json<{ movimientos: MovimientoDTO[] }>(req("GET", "/pendientes"));
      expect(final.movimientos.filter((m) => m.concepto === "Seguro del auto").map((m) => m.id)).toEqual([seguro.id]);
    });

    it("editar un fijo actualiza su pendiente sin confirmar; pausarlo lo saca", async () => {
      const { recurrencias } = await json<{ recurrencias: (Record<string, unknown> & { id: string; concepto: string })[] }>(req("GET", "/recurrencias"));
      const { id, montoMensual: _, ...gym } = recurrencias.find((r) => r.concepto === "Gimnasio Leo")!;
      expect((await req("PUT", `/recurrencias/${id}`, { body: { ...gym, diaDelMes: 7, montoEstimado: "33000" } })).status).toBe(200);
      const pendiente = async () => (await json<{ movimientos: MovimientoDTO[] }>(req("GET", "/pendientes"))).movimientos.find((m) => m.recurrenciaId === id);
      expect(await pendiente()).toMatchObject({ monto: "33000", fechaConsumo: `${hoy.slice(0, 7)}-07` });

      await req("PUT", `/recurrencias/${id}`, { body: { ...gym, activa: false } });
      expect(await pendiente()).toBeUndefined();
    });

    it("un omitido se puede deshacer; un pendiente no", async () => {
      const { movimientos } = await json<{ movimientos: MovimientoDTO[] }>(req("GET", "/pendientes"));
      const internet = movimientos.find((m) => m.concepto === "Internet")!;
      expect((await req("POST", `/pendientes/${internet.id}/reabrir`, { body: {} })).status).toBe(404);
      await req("POST", `/pendientes/${internet.id}/omitir`);
      const r = await json<{ movimiento: MovimientoDTO }>(req("POST", `/pendientes/${internet.id}/reabrir`, { body: {} }));
      expect(r.movimiento.estado).toBe("pendiente");
    });
  });

  describe("movimientos", () => {
    it("un gasto con tarjeta impacta a mes vencido (respetando el cierre)", async () => {
      const mes = hoy.slice(0, 7);
      const r = await req("POST", "/movimientos", {
        body: { tipo: "gasto", monto: "45000", fechaConsumo: `${mes}-10`, cuentaId: ids["Tarjeta Ana"], categoriaId: ids["Súper"] },
      });
      expect(r.status).toBe(201);
      const { movimiento } = (await r.json()) as { movimiento: MovimientoDTO };
      // Tarjeta Ana: cierre 24, vence el 5
      expect(movimiento.fechaImpacto).toBe(`${sumarMeses(mes, 1)}-05`);
      expect(movimiento).toMatchObject({ duenoId: ids.Ana, ambito: "compartido", creadoPorId: ids.Ana });

      const tarde = await json<{ movimiento: MovimientoDTO }>(
        req("POST", "/movimientos", { body: { tipo: "gasto", monto: "1000", fechaConsumo: `${mes}-26`, cuentaId: ids["Tarjeta Ana"] } }),
      );
      expect(tarde.movimiento.fechaImpacto).toBe(`${sumarMeses(mes, 2)}-05`);
    });

    it("un gasto en dólares usa la última cotización", async () => {
      const r = await json<{ movimiento: MovimientoDTO }>(
        req("POST", "/movimientos", { body: { tipo: "gasto", monto: "10", moneda: "USD", fechaConsumo: hoy, cuentaId: ids["Billetera virtual"] } }),
      );
      expect(r.movimiento).toMatchObject({ cotizacion: "1400", montoBase: "14000" });
    });

    it("una transferencia entre personas no cambia los gastos del hogar", async () => {
      const mes = hoy.slice(0, 7);
      const antes = await json<DashboardDTO>(req("GET", `/dashboard?mes=${mes}`));
      const r = await req("POST", "/movimientos", {
        body: { tipo: "transferencia", monto: "150000", fechaConsumo: hoy, cuentaId: ids["Billetera virtual"], cuentaDestinoId: ids["Tarjeta Leo"] },
      });
      expect(r.status).toBe(201);
      const despues = await json<DashboardDTO>(req("GET", `/dashboard?mes=${mes}`));
      expect(despues.gastos).toBe(antes.gastos);
      expect(despues.ingresos).toBe(antes.ingresos);

      const leo = await json<DashboardDTO>(req("GET", `/dashboard?mes=${mes}&vista=${ids.Leo}`));
      expect(Number(leo.recibidas)).toBeGreaterThanOrEqual(150000);
    });

    it("edita y recalcula el impacto al cambiar de cuenta", async () => {
      const { movimiento } = await json<{ movimiento: MovimientoDTO }>(
        req("POST", "/movimientos", { body: { tipo: "gasto", monto: "5000", fechaConsumo: hoy, cuentaId: ids["Efectivo"] } }),
      );
      expect(movimiento.fechaImpacto).toBe(hoy);
      const editado = await json<{ movimiento: MovimientoDTO }>(req("PATCH", `/movimientos/${movimiento.id}`, { body: { cuentaId: ids["Tarjeta Leo"] } }));
      expect(editado.movimiento.fechaImpacto).toBe(`${sumarMeses(hoy.slice(0, 7), 1)}-10`);
      expect((await req("DELETE", `/movimientos/${movimiento.id}`)).status).toBe(200);
      expect((await req("GET", `/movimientos/${movimiento.id}`)).status).toBe(404);
    });

    it("valida con mensajes claros", async () => {
      const malo = await req("POST", "/movimientos", { body: { tipo: "gasto", monto: "12,5", fechaConsumo: hoy, cuentaId: ids.Efectivo } });
      expect(malo.status).toBe(400);
      expect(((await malo.json()) as { error: string }).error).toMatch(/monto/i);

      const sinDestino = await req("POST", "/movimientos", { body: { tipo: "transferencia", monto: "10", fechaConsumo: hoy, cuentaId: ids.Efectivo } });
      expect(sinDestino.status).toBe(400);

      const categoriaDeIngreso = await req("POST", "/movimientos", {
        body: { tipo: "gasto", monto: "10", fechaConsumo: hoy, cuentaId: ids.Efectivo, categoriaId: ids.Sueldo },
      });
      expect(categoriaDeIngreso.status).toBe(400);
    });

    it("no deja borrar una cuenta con movimientos", async () => {
      expect((await req("DELETE", `/cuentas/${ids["Billetera virtual"]}`)).status).toBe(409);
    });
  });

  describe("cuotas", () => {
    it("crea el plan con sus N cuotas y al cancelarlo borra las futuras", async () => {
      const r = await req("POST", "/cuotas", {
        body: { descripcion: "Notebook", montoCuota: "100000", cantidadCuotas: 6, fechaCompra: hoy, cuentaId: ids["Tarjeta Ana"], categoriaId: ids.Imprevistos },
      });
      expect(r.status).toBe(201);
      const { plan } = (await r.json()) as { plan: { id: string; total: number; restante: string } };
      expect(plan.total).toBe(6);
      expect(plan.restante).toBe("600000");
      expect(await p.movimiento.count({ where: { planCuotasId: plan.id } })).toBe(6);

      const renombrado = await json<{ plan: { descripcion: string; total: number } }>(req("PATCH", `/cuotas/${plan.id}`, { body: { descripcion: "Notebook nueva" } }));
      expect(renombrado.plan).toMatchObject({ descripcion: "Notebook nueva", total: 6 });

      expect((await req("DELETE", `/cuotas/${plan.id}`)).status).toBe(200);
      expect(await p.movimiento.count({ where: { nota: null, monto: "100000", cuentaId: ids["Tarjeta Ana"], fechaImpacto: { gt: new Date(`${hoy}T00:00:00Z`) } } })).toBe(0);
    });
  });

  describe("proyección", () => {
    it("proyecta 6 meses con eventos, cuotas y alertas", async () => {
      const r = await json<ProyeccionDTO>(req("GET", "/proyeccion?meses=6"));
      expect(r.meses).toHaveLength(6);
      expect(r.umbral).toBe("250000");
      const todas = r.meses.flatMap((m) => m.lineas.map((l) => l.concepto));
      expect(todas).toContain("Fiestas de fin de año");
      expect(todas.some((c) => c.startsWith("Heladera"))).toBe(true);
      for (const m of r.meses) {
        expect(["ok", "ambar", "rojo"]).toContain(m.alerta);
        expect(Number(m.sobra)).toBeCloseTo(
          Number(m.ingresos) - Number(m.fijos) - Number(m.cuotas) - Number(m.eventos) - Number(m.variables) + Number(m.transferencias),
          2,
        );
      }
    });

    it("rechaza vistas inexistentes", async () => {
      expect((await req("GET", "/proyeccion?vista=nadie")).status).toBe(400);
    });
  });

  describe("IA", () => {
    it("sin API key responde 501", async () => {
      expect((await req("POST", "/ai/parse", { body: { texto: "super 45000" } })).status).toBe(501);
    });
  });
});

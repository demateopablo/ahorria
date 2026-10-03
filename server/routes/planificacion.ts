import { Hono } from "hono";
import { z } from "zod";
import { esMes, mesDe } from "../../shared/domain/fechas.js";
import { planCuotasInput, planCuotasPatch, recurrenciaInput } from "../../shared/schemas/api.js";
import { planCuotasDTO, recurrenciaDTO } from "../dto.js";
import { deFecha } from "../fechas.js";
import { cuerpo, HttpError, validar } from "../http.js";
import { calcularDashboard, calcularProyeccion, validarVista } from "../services/analisis.js";
import { cargarContexto } from "../services/contexto.js";
import { crearPlanCuotas, eliminarPlanCuotas } from "../services/cuotas.js";
import type { AppEnv } from "../tipos-hono.js";

// ─── Recurrencias ────────────────────────────────────────────────────────

export const recurrencias = new Hono<AppEnv>();

async function validarRefsRecurrencia(c: { var: AppEnv["Variables"] }, d: { cuentaId: string; categoriaId?: string | null; duenoId?: string | null }) {
  const p = c.var.p;
  const [cuenta, categoria, dueno] = await Promise.all([
    p.cuenta.findUnique({ where: { id: d.cuentaId } }),
    d.categoriaId ? p.categoria.findUnique({ where: { id: d.categoriaId } }) : true,
    d.duenoId ? p.persona.findUnique({ where: { id: d.duenoId } }) : true,
  ]);
  if (!cuenta) throw new HttpError(400, "La cuenta no existe");
  if (!categoria) throw new HttpError(400, "La categoría no existe");
  if (!dueno) throw new HttpError(400, "La persona no existe");
}

function datosRecurrencia(d: ReturnType<typeof recurrenciaInput.parse>) {
  return {
    ...d,
    desde: deFecha(d.desde ?? null),
    fechaFin: deFecha(d.fechaFin ?? null),
    montoMin: d.montoMin ?? null,
    montoMax: d.montoMax ?? null,
    reglaAjuste: d.reglaAjuste ?? null,
    categoriaId: d.categoriaId ?? null,
    duenoId: d.duenoId ?? null,
    nota: d.nota ?? null,
  };
}

recurrencias.get("/", async (c) => {
  const lista = await c.var.p.recurrencia.findMany({ orderBy: [{ activa: "desc" }, { tipo: "desc" }, { concepto: "asc" }] });
  return c.json({ recurrencias: lista.map(recurrenciaDTO) });
});

recurrencias.post("/", async (c) => {
  const d = await cuerpo(c, recurrenciaInput);
  await validarRefsRecurrencia(c, d);
  const r = await c.var.p.recurrencia.create({ data: datosRecurrencia(d) });
  return c.json({ recurrencia: recurrenciaDTO(r) }, 201);
});

/** PUT reemplaza la plantilla. Los pendientes ya generados no cambian (se editan al confirmar). */
recurrencias.put("/:id", async (c) => {
  const d = await cuerpo(c, recurrenciaInput);
  await validarRefsRecurrencia(c, d);
  const id = c.req.param("id");
  if (!(await c.var.p.recurrencia.findUnique({ where: { id } }))) throw new HttpError(404, "No existe la recurrencia");
  const r = await c.var.p.recurrencia.update({ where: { id }, data: datosRecurrencia(d) });
  return c.json({ recurrencia: recurrenciaDTO(r) });
});

/** Borra la recurrencia y sus pendientes sin confirmar; lo confirmado queda. */
recurrencias.delete("/:id", async (c) => {
  const p = c.var.p;
  const id = c.req.param("id");
  if (!(await p.recurrencia.findUnique({ where: { id } }))) throw new HttpError(404, "No existe la recurrencia");
  await p.$transaction([
    p.movimiento.deleteMany({ where: { recurrenciaId: id, estado: { in: ["pendiente", "omitido"] } } }),
    p.recurrencia.delete({ where: { id } }),
  ]);
  return c.json({ ok: true });
});

// ─── Planes de cuotas ────────────────────────────────────────────────────

export const cuotas = new Hono<AppEnv>();

cuotas.get("/", async (c) => {
  const ctx = await cargarContexto(c.var.p);
  const lista = await c.var.p.planCuotas.findMany({ orderBy: { primeraFechaImpacto: "desc" } });
  const planes = lista.map((pl) => planCuotasDTO(pl, ctx.hoy));
  const activos = c.req.query("todos") ? planes : planes.filter((pl) => pl.proximaFecha);
  return c.json({ planes: activos });
});

cuotas.post("/", async (c) => {
  const ctx = await cargarContexto(c.var.p);
  const d = await cuerpo(c, planCuotasInput);
  const plan = await crearPlanCuotas(c.var.p, d, c.var.sesion.personaId, ctx);
  return c.json({ plan: planCuotasDTO(plan, ctx.hoy) }, 201);
});

cuotas.patch("/:id", async (c) => {
  const ctx = await cargarContexto(c.var.p);
  const d = await cuerpo(c, planCuotasPatch);
  const id = c.req.param("id");
  if (!(await c.var.p.planCuotas.findUnique({ where: { id } }))) throw new HttpError(404, "No existe el plan de cuotas");
  const plan = await c.var.p.planCuotas.update({ where: { id }, data: { descripcion: d.descripcion } });
  return c.json({ plan: planCuotasDTO(plan, ctx.hoy) });
});

cuotas.delete("/:id", async (c) => {
  const ctx = await cargarContexto(c.var.p);
  await eliminarPlanCuotas(c.var.p, c.req.param("id"), ctx);
  return c.json({ ok: true });
});

// ─── Análisis ────────────────────────────────────────────────────────────

export const analisis = new Hono<AppEnv>();

analisis.get("/dashboard", async (c) => {
  const p = c.var.p;
  const ctx = await cargarContexto(p);
  const mes = c.req.query("mes") ?? mesDe(ctx.hoy);
  if (!esMes(mes)) throw new HttpError(400, "Mes inválido");
  const vista = await validarVista(p, c.req.query("vista"));
  return c.json(await calcularDashboard(p, ctx, vista, mes));
});

analisis.get("/proyeccion", async (c) => {
  const p = c.var.p;
  const ctx = await cargarContexto(p);
  const meses = validar(z.coerce.number().int().min(1).max(24).default(6), c.req.query("meses"));
  const vista = await validarVista(p, c.req.query("vista"));
  return c.json(await calcularProyeccion(p, ctx, vista, meses));
});

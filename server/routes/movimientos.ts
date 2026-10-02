import { Hono } from "hono";
import { esFecha, esMes, ultimoDia } from "../../shared/domain/fechas.js";
import { confirmarInput, movimientoInput, movimientoPatch } from "../../shared/schemas/api.js";
import { movimientoDTO } from "../dto.js";
import { deFecha } from "../fechas.js";
import type { Prisma } from "../generated/prisma/client.js";
import { cuerpo, HttpError } from "../http.js";
import { validarVista } from "../services/analisis.js";
import { cargarContexto } from "../services/contexto.js";
import { actualizarMovimiento, crearMovimiento, incluir } from "../services/movimientos.js";
import { asegurarPendientes } from "../services/pendientes.js";
import type { AppEnv } from "../tipos-hono.js";

export const movimientos = new Hono<AppEnv>();

/**
 * GET /api/movimientos?mes=2026-10 | desde&hasta (fechas), vista, categoria, cuenta, estado
 * Por defecto filtra por fecha de consumo (lo que el usuario recuerda); `por=impacto` usa el impacto.
 */
movimientos.get("/", async (c) => {
  const p = c.var.p;
  const ctx = await cargarContexto(p);
  const q = c.req.query();
  let desde: string;
  let hasta: string;
  if (q.mes) {
    if (!esMes(q.mes)) throw new HttpError(400, "Mes inválido");
    desde = `${q.mes}-01`;
    hasta = ultimoDia(q.mes);
  } else {
    desde = q.desde ?? `${ctx.hoy.slice(0, 7)}-01`;
    hasta = q.hasta ?? ultimoDia(ctx.hoy.slice(0, 7));
    if (!esFecha(desde) || !esFecha(hasta)) throw new HttpError(400, "Fechas inválidas");
  }
  const vista = await validarVista(p, q.vista);
  const campo = q.por === "impacto" ? "fechaImpacto" : "fechaConsumo";

  const filtros: Prisma.MovimientoWhereInput[] = [
    { [campo]: { gte: deFecha(desde), lte: deFecha(hasta) } },
    q.estado ? { estado: q.estado as "confirmado" | "pendiente" | "omitido" } : { estado: { not: "omitido" } },
  ];
  if (q.categoria) filtros.push({ OR: [{ categoriaId: q.categoria }, { categoria: { padreId: q.categoria } }] });
  if (q.cuenta) filtros.push({ OR: [{ cuentaId: q.cuenta }, { cuentaDestinoId: q.cuenta }] });
  if (vista !== "hogar") {
    filtros.push({
      OR: [{ duenoId: vista }, { tipo: "transferencia", cuentaDestino: { titularId: vista } }, { tipo: "transferencia", cuenta: { titularId: vista } }],
    });
  }
  const where: Prisma.MovimientoWhereInput = { AND: filtros };
  const lista = await p.movimiento.findMany({
    where,
    include: incluir,
    orderBy: [{ [campo]: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  return c.json({ movimientos: lista.map((m) => movimientoDTO(m, ctx.base, ctx.cotizacion)) });
});

movimientos.get("/:id", async (c) => {
  const ctx = await cargarContexto(c.var.p);
  const m = await c.var.p.movimiento.findUnique({ where: { id: c.req.param("id") }, include: incluir });
  if (!m) throw new HttpError(404, "No existe el movimiento");
  return c.json({ movimiento: movimientoDTO(m, ctx.base, ctx.cotizacion) });
});

movimientos.post("/", async (c) => {
  const p = c.var.p;
  const ctx = await cargarContexto(p);
  const datos = await cuerpo(c, movimientoInput);
  const m = await crearMovimiento(p, datos, c.var.sesion.personaId, ctx);
  return c.json({ movimiento: movimientoDTO(m, ctx.base, ctx.cotizacion) }, 201);
});

movimientos.patch("/:id", async (c) => {
  const p = c.var.p;
  const ctx = await cargarContexto(p);
  const patch = await cuerpo(c, movimientoPatch);
  const m = await actualizarMovimiento(p, c.req.param("id"), patch, c.var.sesion.personaId, ctx);
  return c.json({ movimiento: movimientoDTO(m, ctx.base, ctx.cotizacion) });
});

movimientos.delete("/:id", async (c) => {
  const r = await c.var.p.movimiento.deleteMany({ where: { id: c.req.param("id") } });
  if (!r.count) throw new HttpError(404, "No existe el movimiento");
  return c.json({ ok: true });
});

export const pendientes = new Hono<AppEnv>();

/** GET /api/pendientes — genera los del mes si faltan y devuelve todos los pendientes. */
pendientes.get("/", async (c) => {
  const p = c.var.p;
  const ctx = await cargarContexto(p);
  await asegurarPendientes(p, ctx);
  const lista = await p.movimiento.findMany({
    where: { estado: "pendiente" },
    include: incluir,
    orderBy: [{ fechaConsumo: "asc" }],
  });
  return c.json({ movimientos: lista.map((m) => movimientoDTO(m, ctx.base, ctx.cotizacion)) });
});

/** Confirma un pendiente, opcionalmente con el monto real. Si la recurrencia es "de quien pague", queda a nombre de quien confirma. */
pendientes.post("/:id/confirmar", async (c) => {
  const p = c.var.p;
  const ctx = await cargarContexto(p);
  const id = c.req.param("id");
  const datos = await cuerpo(c, confirmarInput);
  const actual = await p.movimiento.findUnique({ where: { id }, include: { recurrencia: { select: { duenoId: true } } } });
  if (!actual || actual.estado !== "pendiente") throw new HttpError(404, "No existe el pendiente");
  const duenoId = datos.duenoId ?? (actual.recurrencia && !actual.recurrencia.duenoId ? c.var.sesion.personaId : undefined);
  const m = await actualizarMovimiento(
    p,
    id,
    { monto: datos.monto, fechaConsumo: datos.fechaConsumo, cuentaId: datos.cuentaId, duenoId, estado: "confirmado" },
    c.var.sesion.personaId,
    ctx,
  );
  return c.json({ movimiento: movimientoDTO(m, ctx.base, ctx.cotizacion) });
});

pendientes.post("/:id/omitir", async (c) => {
  const r = await c.var.p.movimiento.updateMany({ where: { id: c.req.param("id"), estado: "pendiente" }, data: { estado: "omitido" } });
  if (!r.count) throw new HttpError(404, "No existe el pendiente");
  return c.json({ ok: true });
});

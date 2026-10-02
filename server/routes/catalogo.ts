import { Hono } from "hono";
import { sumarMeses } from "../../shared/domain/fechas.js";
import {
  categoriaInput,
  configPatch,
  cotizacionInput,
  cuentaInput,
  eventoInput,
  personaInput,
  type BootstrapDTO,
} from "../../shared/schemas/api.js";
import { categoriaDTO, configDTO, cotizacionDTO, cuentaDTO, eventoDTO, personaDTO } from "../dto.js";
import { iaHabilitada } from "../env.js";
import { deFecha } from "../fechas.js";
import { Prisma } from "../generated/prisma/client.js";
import { cuerpo, HttpError } from "../http.js";
import { cargarContexto } from "../services/contexto.js";
import { asegurarPendientes } from "../services/pendientes.js";
import type { AppEnv } from "../tipos-hono.js";

export const catalogo = new Hono<AppEnv>();

/** GET /api/bootstrap — todo lo necesario para levantar la app en una sola llamada. */
catalogo.get("/bootstrap", async (c) => {
  const p = c.var.p;
  const ctx = await cargarContexto(p);
  await asegurarPendientes(p, ctx);
  const hace60 = deFecha(`${sumarMeses(ctx.hoy.slice(0, 7), -2)}-01`);
  const [yo, personas, cuentas, categorias, pendientes, cot, recientes] = await Promise.all([
    p.persona.findUnique({ where: { id: c.var.sesion.personaId } }),
    p.persona.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
    p.cuenta.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
    p.categoria.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
    p.movimiento.count({ where: { estado: "pendiente" } }),
    p.cotizacion.findFirst({ orderBy: { fecha: "desc" } }),
    p.movimiento.findMany({
      where: { fechaConsumo: { gte: hace60 }, categoriaId: { not: null }, estado: "confirmado", planCuotasId: null },
      select: { categoriaId: true, cuentaId: true, tipo: true },
      orderBy: { createdAt: "desc" },
      take: 400,
    }),
  ]);
  if (!yo) throw new HttpError(401, "Sin sesión");

  const cuentaPorCategoria: Record<string, string> = {};
  const usos = new Map<string, number>();
  for (const m of recientes) {
    if (!m.categoriaId) continue;
    cuentaPorCategoria[m.categoriaId] ??= m.cuentaId;
    if (m.tipo === "gasto") usos.set(m.categoriaId, (usos.get(m.categoriaId) ?? 0) + 1);
  }

  const dto: BootstrapDTO = {
    hoy: ctx.hoy,
    config: configDTO(ctx.config),
    yo: personaDTO(yo),
    personas: personas.map(personaDTO),
    cuentas: cuentas.map(cuentaDTO),
    categorias: categorias.map(categoriaDTO),
    pendientes,
    ultimaCotizacion: cot ? cotizacionDTO(cot) : null,
    cuentaPorCategoria,
    categoriasRecientes: [...usos.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id),
    ia: iaHabilitada(),
  };
  return c.json(dto);
});

catalogo.patch("/config", async (c) => {
  const d = await cuerpo(c, configPatch);
  const config = await c.var.p.config.update({ where: { id: 1 }, data: d });
  return c.json({ config: configDTO(config) });
});

/** Traduce errores de clave foránea a un 409 entendible. */
async function borrar(fn: () => Promise<unknown>, mensaje: string) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2003" || e.code === "P2014")) throw new HttpError(409, mensaje);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") throw new HttpError(404, "No existe");
    throw e;
  }
}

async function conUnico<T>(fn: () => Promise<T>, mensaje: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError(409, mensaje);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") throw new HttpError(404, "No existe");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") throw new HttpError(400, "Referencia inválida");
    throw e;
  }
}

// ─── Personas ────────────────────────────────────────────────────────────

catalogo.post("/personas", async (c) => {
  const d = await cuerpo(c, personaInput);
  const persona = await conUnico(() => c.var.p.persona.create({ data: { ...d, email: d.email ?? null } }), "Ya hay una persona con ese email");
  return c.json({ persona: personaDTO(persona) }, 201);
});

catalogo.put("/personas/:id", async (c) => {
  const d = await cuerpo(c, personaInput);
  const id = c.req.param("id");
  if (id === c.var.sesion.personaId && (d.email ?? null) !== c.var.sesion.email) {
    throw new HttpError(400, "No podés cambiar tu propio email: te quedarías sin acceso");
  }
  const persona = await conUnico(() => c.var.p.persona.update({ where: { id }, data: { ...d, email: d.email ?? null } }), "Ya hay una persona con ese email");
  return c.json({ persona: personaDTO(persona) });
});

catalogo.delete("/personas/:id", async (c) => {
  const id = c.req.param("id");
  if (id === c.var.sesion.personaId) throw new HttpError(400, "No podés borrarte a vos");
  await borrar(() => c.var.p.persona.delete({ where: { id } }), "Tiene movimientos, cuentas o recurrencias: no se puede borrar");
  return c.json({ ok: true });
});

// ─── Cuentas ─────────────────────────────────────────────────────────────

function datosCuenta(d: ReturnType<typeof cuentaInput.parse>) {
  const tarjeta = d.tipo === "tarjeta_credito";
  return {
    ...d,
    fechaSaldoInicial: deFecha(d.fechaSaldoInicial ?? null),
    tna: d.tna ?? null,
    diaCierre: tarjeta ? (d.diaCierre ?? null) : null,
    diaVencimiento: tarjeta ? (d.diaVencimiento ?? null) : null,
  };
}

catalogo.post("/cuentas", async (c) => {
  const d = await cuerpo(c, cuentaInput);
  const cuenta = await conUnico(() => c.var.p.cuenta.create({ data: datosCuenta(d) }), "Ya existe");
  return c.json({ cuenta: cuentaDTO(cuenta) }, 201);
});

catalogo.put("/cuentas/:id", async (c) => {
  const d = await cuerpo(c, cuentaInput);
  const cuenta = await conUnico(() => c.var.p.cuenta.update({ where: { id: c.req.param("id") }, data: datosCuenta(d) }), "Ya existe");
  return c.json({ cuenta: cuentaDTO(cuenta) });
});

catalogo.delete("/cuentas/:id", async (c) => {
  await borrar(() => c.var.p.cuenta.delete({ where: { id: c.req.param("id") } }), "La cuenta tiene movimientos: archivala en lugar de borrarla");
  return c.json({ ok: true });
});

// ─── Categorías ──────────────────────────────────────────────────────────

async function validarPadre(c: { var: AppEnv["Variables"] }, padreId: string | null | undefined, id?: string) {
  if (!padreId) return;
  if (padreId === id) throw new HttpError(400, "Una categoría no puede ser su propia madre");
  const padre = await c.var.p.categoria.findUnique({ where: { id: padreId } });
  if (!padre) throw new HttpError(400, "La categoría padre no existe");
  if (padre.padreId) throw new HttpError(400, "Solo se admite un nivel de subcategorías");
}

catalogo.post("/categorias", async (c) => {
  const d = await cuerpo(c, categoriaInput);
  await validarPadre(c, d.padreId);
  const cat = await conUnico(() => c.var.p.categoria.create({ data: { ...d, padreId: d.padreId ?? null } }), "Ya existe");
  return c.json({ categoria: categoriaDTO(cat) }, 201);
});

catalogo.put("/categorias/:id", async (c) => {
  const d = await cuerpo(c, categoriaInput);
  const id = c.req.param("id");
  await validarPadre(c, d.padreId, id);
  if (d.padreId && (await c.var.p.categoria.count({ where: { padreId: id } }))) {
    throw new HttpError(400, "Tiene subcategorías: no puede pasar a ser subcategoría");
  }
  const cat = await conUnico(() => c.var.p.categoria.update({ where: { id }, data: { ...d, padreId: d.padreId ?? null } }), "Ya existe");
  return c.json({ categoria: categoriaDTO(cat) });
});

catalogo.delete("/categorias/:id", async (c) => {
  await borrar(() => c.var.p.categoria.delete({ where: { id: c.req.param("id") } }), "La categoría está en uso: archivala en lugar de borrarla");
  return c.json({ ok: true });
});

// ─── Eventos ─────────────────────────────────────────────────────────────

catalogo.get("/eventos", async (c) => {
  const lista = await c.var.p.evento.findMany({ orderBy: [{ mes: "asc" }, { dia: "asc" }, { nombre: "asc" }] });
  return c.json({ eventos: lista.map(eventoDTO) });
});

catalogo.post("/eventos", async (c) => {
  const d = await cuerpo(c, eventoInput);
  const ev = await conUnico(
    () => c.var.p.evento.create({ data: { ...d, dia: d.dia ?? null, categoriaId: d.categoriaId ?? null, duenoId: d.duenoId ?? null } }),
    "Ya existe",
  );
  return c.json({ evento: eventoDTO(ev) }, 201);
});

catalogo.put("/eventos/:id", async (c) => {
  const d = await cuerpo(c, eventoInput);
  const ev = await conUnico(
    () =>
      c.var.p.evento.update({
        where: { id: c.req.param("id") },
        data: { ...d, dia: d.dia ?? null, categoriaId: d.categoriaId ?? null, duenoId: d.duenoId ?? null },
      }),
    "Ya existe",
  );
  return c.json({ evento: eventoDTO(ev) });
});

catalogo.delete("/eventos/:id", async (c) => {
  await borrar(() => c.var.p.evento.delete({ where: { id: c.req.param("id") } }), "No se puede borrar");
  return c.json({ ok: true });
});

// ─── Cotizaciones ────────────────────────────────────────────────────────

catalogo.get("/cotizaciones", async (c) => {
  const lista = await c.var.p.cotizacion.findMany({ orderBy: { fecha: "desc" }, take: 60 });
  return c.json({ cotizaciones: lista.map(cotizacionDTO) });
});

/** Crea o reemplaza la cotización de ese día y tipo. */
catalogo.post("/cotizaciones", async (c) => {
  const d = await cuerpo(c, cotizacionInput);
  const fecha = deFecha(d.fecha);
  const cot = await c.var.p.cotizacion.upsert({
    where: { fecha_tipo: { fecha, tipo: d.tipo } },
    create: { fecha, tipo: d.tipo, valor: d.valor },
    update: { valor: d.valor },
  });
  return c.json({ cotizacion: cotizacionDTO(cot) }, 201);
});

catalogo.delete("/cotizaciones/:id", async (c) => {
  await borrar(() => c.var.p.cotizacion.delete({ where: { id: c.req.param("id") } }), "No se puede borrar");
  return c.json({ ok: true });
});

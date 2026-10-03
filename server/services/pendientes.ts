import { hoy, mesDe, sumarMeses } from "../../shared/domain/fechas.js";
import { formatMes } from "../../shared/format.js";
import { fechaImpacto } from "../../shared/domain/impacto.js";
import { fechaOcurrencia, ocurreEn, periodos } from "../../shared/domain/recurrencias.js";
import type { PrismaClient } from "../db.js";
import { aFecha, deFecha } from "../fechas.js";
import type { Prisma } from "../generated/prisma/client.js";
import { HttpError } from "../http.js";
import type { Contexto } from "./contexto.js";

/**
 * Genera los movimientos "pendientes de confirmar" de cada recurrencia activa hasta el mes actual.
 * Es idempotente: arranca desde `generadoHasta` y hay un único por (recurrencia, período).
 * Una recurrencia nueva empieza a generar desde el mes en curso (no rellena el pasado).
 * Las variables (súper, nafta) no generan pendientes: se cargan compra por compra.
 */
export async function asegurarPendientes(p: PrismaClient, ctx: Contexto): Promise<number> {
  const mesActual = mesDe(ctx.hoy);
  const recs = await p.recurrencia.findMany({
    where: { activa: true, variable: false, OR: [{ generadoHasta: null }, { generadoHasta: { lt: mesActual } }] },
    include: { cuenta: true },
  });
  if (!recs.length) return 0;

  const nuevos: Prisma.MovimientoCreateManyInput[] = [];
  for (const r of recs) {
    const desde = r.generadoHasta ? sumarMeses(r.generadoHasta, 1) : mesActual;
    for (const periodo of periodos(calendario(r), desde, mesActual)) nuevos.push(pendienteDe(r, periodo, ctx));
  }

  const [creados] = await p.$transaction([
    p.movimiento.createMany({ data: nuevos, skipDuplicates: true }),
    p.recurrencia.updateMany({ where: { id: { in: recs.map((r) => r.id) } }, data: { generadoHasta: mesActual } }),
  ]);
  return creados.count;
}

type RecurrenciaConCuenta = Prisma.RecurrenciaGetPayload<{ include: { cuenta: true } }>;

function calendario(r: RecurrenciaConCuenta) {
  return { frecuencia: r.frecuencia, mesAncla: r.mesAncla, diaDelMes: r.diaDelMes, desde: aFecha(r.desde), fechaFin: aFecha(r.fechaFin) };
}

/** El movimiento pendiente de una recurrencia para un período (mes de consumo). */
export function pendienteDe(r: RecurrenciaConCuenta, periodo: string, ctx: Contexto): Prisma.MovimientoCreateManyInput {
  const consumo = fechaOcurrencia(r, periodo);
  return {
    tipo: r.tipo,
    estado: "pendiente",
    monto: r.montoEstimado,
    moneda: r.moneda,
    cotizacion: r.moneda === ctx.base ? null : ctx.cotizacion,
    fechaConsumo: deFecha(consumo),
    fechaImpacto: deFecha(fechaImpacto(consumo, r.cuenta)),
    categoriaId: r.categoriaId,
    duenoId: r.duenoId ?? r.cuenta.titularId,
    ambito: r.ambito,
    cuentaId: r.cuentaId,
    etiquetas: r.etiquetas,
    recurrenciaId: r.id,
    periodo,
  };
}

/**
 * Un movimiento de recurrencia cubre el período de su fecha de consumo. Si la fecha pasa a otro mes
 * (ej. se confirma el seguro de octubre con la fecha real del cobro, en septiembre), el movimiento pasa
 * a cubrir ese mes y el que deja libre vuelve a quedar pendiente; si no, la proyección estimaría el mes
 * nuevo aunque ya esté pago y daría por cubierto el viejo.
 *
 * Si el mes nuevo tiene un pendiente sin confirmar, este lo reemplaza; si ya tiene uno confirmado u
 * omitido, es un error. Devuelve las operaciones a correr junto con la actualización (o null si no cambia).
 */
export async function reubicarPeriodo(
  p: PrismaClient,
  actual: { id: string; recurrenciaId: string | null; periodo: string | null },
  nuevaFecha: string,
  ctx: Contexto,
) {
  const nuevo = mesDe(nuevaFecha);
  if (!actual.recurrenciaId || !actual.periodo || actual.periodo === nuevo) return null;
  const [ocupante, r] = await Promise.all([
    p.movimiento.findUnique({ where: { recurrenciaId_periodo: { recurrenciaId: actual.recurrenciaId, periodo: nuevo } } }),
    p.recurrencia.findUnique({ where: { id: actual.recurrenciaId }, include: { cuenta: true } }),
  ]);
  if (ocupante && ocupante.id !== actual.id && ocupante.estado !== "pendiente") {
    throw new HttpError(409, `Ya hay un "${r?.concepto ?? "movimiento"}" ${ocupante.estado} para ${formatMes(nuevo)}`);
  }
  const antes: Prisma.PrismaPromise<unknown>[] = [];
  if (ocupante && ocupante.id !== actual.id) antes.push(p.movimiento.delete({ where: { id: ocupante.id } }));
  const despues: Prisma.PrismaPromise<unknown>[] = [];
  // Solo se repone si el generador ya cubrió ese mes (desde que existe la recurrencia hasta generadoHasta).
  const viejo = actual.periodo;
  const cubierto = r?.generadoHasta && viejo <= r.generadoHasta && viejo >= mesDe(hoy(undefined, r.createdAt));
  if (r?.activa && cubierto && ocurreEn(calendario(r), viejo)) {
    despues.push(p.movimiento.create({ data: pendienteDe(r, viejo, ctx) }));
  }
  return { periodo: nuevo, antes, despues };
}

/**
 * Al editar una recurrencia, sus pendientes sin confirmar toman la plantilla nueva (día, monto,
 * cuenta…): si no, quedaba el día viejo y se confirmaba con esa fecha. Los que dejan de corresponder
 * (otra frecuencia, pausada o pasada a variable) se borran. Lo confirmado u omitido no se toca.
 */
export async function sincronizarPendientes(p: PrismaClient, recurrenciaId: string, ctx: Contexto) {
  const r = await p.recurrencia.findUnique({ where: { id: recurrenciaId }, include: { cuenta: true } });
  if (!r) return;
  const pendientes = await p.movimiento.findMany({ where: { recurrenciaId, estado: "pendiente" } });
  const sigue = (periodo: string | null) => periodo && r.activa && !r.variable && ocurreEn(calendario(r), periodo);
  await p.$transaction([
    p.movimiento.deleteMany({ where: { id: { in: pendientes.filter((m) => !sigue(m.periodo)).map((m) => m.id) } } }),
    ...pendientes
      .filter((m) => sigue(m.periodo))
      .map((m) => {
        const { estado: _e, recurrenciaId: _r, periodo: _p, ...datos } = pendienteDe(r, m.periodo!, ctx);
        return p.movimiento.update({ where: { id: m.id }, data: datos });
      }),
  ]);
}

import { mesDe, sumarMeses } from "../../shared/domain/fechas.js";
import { fechaImpacto } from "../../shared/domain/impacto.js";
import { fechaOcurrencia, periodos } from "../../shared/domain/recurrencias.js";
import type { PrismaClient } from "../db.js";
import { aFecha, deFecha } from "../fechas.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { Contexto } from "./contexto.js";

/**
 * Genera los movimientos "pendientes de confirmar" de cada recurrencia activa hasta el mes actual.
 * Es idempotente: arranca desde `generadoHasta` y hay un único por (recurrencia, período).
 * Una recurrencia nueva empieza a generar desde el mes en curso (no rellena el pasado).
 */
export async function asegurarPendientes(p: PrismaClient, ctx: Contexto): Promise<number> {
  const mesActual = mesDe(ctx.hoy);
  const recs = await p.recurrencia.findMany({
    where: { activa: true, OR: [{ generadoHasta: null }, { generadoHasta: { lt: mesActual } }] },
    include: { cuenta: true },
  });
  if (!recs.length) return 0;

  const nuevos: Prisma.MovimientoCreateManyInput[] = [];
  for (const r of recs) {
    const desde = r.generadoHasta ? sumarMeses(r.generadoHasta, 1) : mesActual;
    const cal = { frecuencia: r.frecuencia, mesAncla: r.mesAncla, diaDelMes: r.diaDelMes, desde: aFecha(r.desde), fechaFin: aFecha(r.fechaFin) };
    for (const periodo of periodos(cal, desde, mesActual)) {
      const consumo = fechaOcurrencia(r, periodo);
      nuevos.push({
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
      });
    }
  }

  const [creados] = await p.$transaction([
    p.movimiento.createMany({ data: nuevos, skipDuplicates: true }),
    p.recurrencia.updateMany({ where: { id: { in: recs.map((r) => r.id) } }, data: { generadoHasta: mesActual } }),
  ]);
  return creados.count;
}

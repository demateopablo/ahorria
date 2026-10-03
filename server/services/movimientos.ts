import { dec } from "../../shared/domain/dinero.js";
import { fechaImpacto } from "../../shared/domain/impacto.js";
import type { MovimientoCalc } from "../../shared/domain/tipos.js";
import { movimientoInput, type MovimientoInput } from "../../shared/schemas/api.js";
import type { PrismaClient } from "../db.js";
import { conceptoMovimiento, montoBaseMovimiento } from "../dto.js";
import { aFecha, deFecha } from "../fechas.js";
import type { Prisma } from "../generated/prisma/client.js";
import { HttpError, validar } from "../http.js";
import type { Contexto } from "./contexto.js";
import { reubicarPeriodo } from "./pendientes.js";

type Datos = ReturnType<typeof movimientoInput.parse>;

/** Valida referencias y completa los defaults (impacto, ámbito, dueño, cotización). */
async function resolver(p: PrismaClient, m: Datos, yoId: string, ctx: Contexto) {
  const [cuenta, destino, categoria, dueno] = await Promise.all([
    p.cuenta.findUnique({ where: { id: m.cuentaId } }),
    m.cuentaDestinoId ? p.cuenta.findUnique({ where: { id: m.cuentaDestinoId } }) : null,
    m.categoriaId ? p.categoria.findUnique({ where: { id: m.categoriaId } }) : null,
    p.persona.findUnique({ where: { id: m.duenoId ?? yoId } }),
  ]);
  if (!cuenta) throw new HttpError(400, "La cuenta no existe");
  if (m.cuentaDestinoId && !destino) throw new HttpError(400, "La cuenta de destino no existe");
  if (m.categoriaId && !categoria) throw new HttpError(400, "La categoría no existe");
  if (!dueno) throw new HttpError(400, "La persona no existe");
  if (categoria && m.tipo !== "transferencia" && categoria.tipo !== m.tipo) {
    throw new HttpError(400, `La categoría "${categoria.nombre}" es de ${categoria.tipo === "gasto" ? "gastos" : "ingresos"}`);
  }

  let cotizacion = m.cotizacion ?? null;
  if (m.moneda !== ctx.base && !cotizacion) {
    cotizacion = ctx.cotizacion;
    if (!cotizacion) throw new HttpError(400, "Cargá la cotización del dólar para registrar movimientos en USD");
  }

  return {
    tipo: m.tipo,
    monto: m.monto,
    moneda: m.moneda,
    cotizacion: m.moneda === ctx.base ? null : cotizacion,
    fechaConsumo: deFecha(m.fechaConsumo),
    fechaImpacto: deFecha(m.fechaImpacto ?? fechaImpacto(m.fechaConsumo, cuenta)),
    categoriaId: m.tipo === "transferencia" ? null : (m.categoriaId ?? null),
    duenoId: dueno.id,
    ambito: m.ambito ?? categoria?.ambitoDefault ?? "compartido",
    cuentaId: cuenta.id,
    cuentaDestinoId: m.tipo === "transferencia" ? (m.cuentaDestinoId ?? null) : null,
    nota: m.nota || null,
    etiquetas: m.etiquetas,
  } satisfies Prisma.MovimientoUncheckedCreateInput;
}

export async function crearMovimiento(p: PrismaClient, input: Datos, yoId: string, ctx: Contexto) {
  const data = await resolver(p, input, yoId, ctx);
  return p.movimiento.create({ data: { ...data, creadoPorId: yoId }, include: incluir });
}

/** Edita un movimiento. Si cambia la fecha o la cuenta (y no se fija el impacto a mano), se recalcula el impacto. */
export async function actualizarMovimiento(p: PrismaClient, id: string, patch: Partial<MovimientoInput> & { estado?: string }, yoId: string, ctx: Contexto) {
  const actual = await p.movimiento.findUnique({ where: { id } });
  if (!actual) throw new HttpError(404, "No existe el movimiento");

  const cambiaImpacto = patch.fechaConsumo !== undefined || patch.cuentaId !== undefined;
  const fusion = validar(movimientoInput, {
    tipo: actual.tipo,
    monto: dec(actual.monto).toString(),
    moneda: actual.moneda,
    cotizacion: actual.cotizacion ? dec(actual.cotizacion).toString() : null,
    fechaConsumo: aFecha(actual.fechaConsumo),
    fechaImpacto: cambiaImpacto ? null : aFecha(actual.fechaImpacto),
    categoriaId: actual.categoriaId,
    duenoId: actual.duenoId,
    ambito: actual.ambito,
    cuentaId: actual.cuentaId,
    cuentaDestinoId: actual.cuentaDestinoId,
    nota: actual.nota,
    etiquetas: actual.etiquetas,
    ...Object.fromEntries(Object.entries(patch).filter(([k, v]) => v !== undefined && k !== "estado")),
  });
  const data = await resolver(p, fusion, yoId, ctx);
  const estado = patch.estado as "confirmado" | "pendiente" | "omitido" | undefined;
  const reubicado = await reubicarPeriodo(p, actual, fusion.fechaConsumo, ctx);
  const update = p.movimiento.update({
    where: { id },
    data: { ...data, ...(estado ? { estado } : {}), ...(reubicado ? { periodo: reubicado.periodo } : {}) },
    include: incluir,
  });
  if (!reubicado) return update;
  const res = await p.$transaction([...reubicado.antes, update, ...reubicado.despues]);
  return res[reubicado.antes.length] as Awaited<typeof update>;
}

export const incluir = {
  recurrencia: { select: { concepto: true } },
  planCuotas: { select: { descripcion: true, cantidadCuotas: true, cuotasPrevias: true } },
} as const;

export const incluirCalc = {
  ...incluir,
  cuenta: { select: { titularId: true } },
  cuentaDestino: { select: { titularId: true } },
} as const;

type MovimientoCalcPrisma = Prisma.MovimientoGetPayload<{ include: typeof incluirCalc }>;

/** Prisma → movimiento normalizado para el dominio (monto en moneda base, titulares resueltos). */
export function aCalc(m: MovimientoCalcPrisma, ctx: Contexto): MovimientoCalc {
  return {
    id: m.id,
    tipo: m.tipo,
    estado: m.estado,
    monto: dec(montoBaseMovimiento(m, ctx.base, ctx.cotizacion)),
    fechaImpacto: aFecha(m.fechaImpacto),
    categoriaId: m.categoriaId,
    duenoId: m.duenoId,
    personaOrigenId: m.tipo === "transferencia" ? m.cuenta.titularId : null,
    personaDestinoId: m.tipo === "transferencia" ? (m.cuentaDestino?.titularId ?? null) : null,
    recurrenciaId: m.recurrenciaId,
    periodo: m.periodo,
    planCuotasId: m.planCuotasId,
    concepto: conceptoMovimiento(m),
  };
}

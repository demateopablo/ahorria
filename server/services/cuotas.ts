import { impactosCuotas } from "../../shared/domain/cuotas.js";
import { fechaImpacto } from "../../shared/domain/impacto.js";
import type { planCuotasInput } from "../../shared/schemas/api.js";
import type { PrismaClient } from "../db.js";
import { deFecha } from "../fechas.js";
import { HttpError } from "../http.js";
import type { Contexto } from "./contexto.js";

type Datos = ReturnType<typeof planCuotasInput.parse>;

/** Crea el plan y materializa sus N cuotas como movimientos (uno por mes). */
export async function crearPlanCuotas(p: PrismaClient, d: Datos, yoId: string, _ctx: Contexto) {
  const [cuenta, categoria, dueno] = await Promise.all([
    p.cuenta.findUnique({ where: { id: d.cuentaId } }),
    d.categoriaId ? p.categoria.findUnique({ where: { id: d.categoriaId } }) : null,
    p.persona.findUnique({ where: { id: d.duenoId ?? yoId } }),
  ]);
  if (!cuenta) throw new HttpError(400, "La cuenta no existe");
  if (d.categoriaId && !categoria) throw new HttpError(400, "La categoría no existe");
  if (!dueno) throw new HttpError(400, "La persona no existe");

  const primera = d.primeraFechaImpacto ?? fechaImpacto(d.fechaCompra!, cuenta);
  const ambito = d.ambito ?? categoria?.ambitoDefault ?? "compartido";
  const cuotas = impactosCuotas({ montoCuota: d.montoCuota, cantidadCuotas: d.cantidadCuotas, primeraFechaImpacto: primera });

  return p.$transaction(async (tx) => {
    const plan = await tx.planCuotas.create({
      data: {
        descripcion: d.descripcion,
        montoCuota: d.montoCuota,
        cantidadCuotas: d.cantidadCuotas,
        cuotasPrevias: d.cuotasPrevias,
        primeraFechaImpacto: deFecha(primera),
        fechaCompra: deFecha(d.fechaCompra ?? null),
        cuentaId: cuenta.id,
        categoriaId: categoria?.id ?? null,
        duenoId: dueno.id,
        ambito,
      },
    });
    await tx.movimiento.createMany({
      data: cuotas.map((c) => ({
        tipo: "gasto" as const,
        estado: "confirmado" as const,
        monto: c.monto.toString(),
        moneda: cuenta.moneda,
        fechaConsumo: deFecha(d.fechaCompra ?? c.fechaImpacto),
        fechaImpacto: deFecha(c.fechaImpacto),
        categoriaId: categoria?.id ?? null,
        duenoId: dueno.id,
        ambito,
        cuentaId: cuenta.id,
        nota: d.nota ?? null,
        planCuotasId: plan.id,
        numeroCuota: c.numero,
        creadoPorId: yoId,
      })),
    });
    return plan;
  });
}

/**
 * Cancela un plan (ej. se precanceló): borra las cuotas que todavía no impactaron y el plan.
 * Las cuotas ya pagadas quedan como movimientos sueltos.
 */
export async function eliminarPlanCuotas(p: PrismaClient, id: string, ctx: Contexto) {
  const plan = await p.planCuotas.findUnique({ where: { id } });
  if (!plan) throw new HttpError(404, "No existe el plan de cuotas");
  await p.$transaction([
    p.movimiento.deleteMany({ where: { planCuotasId: id, fechaImpacto: { gt: deFecha(ctx.hoy) } } }),
    p.planCuotas.delete({ where: { id } }),
  ]);
}

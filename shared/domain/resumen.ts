import type { Decimal } from "decimal.js";
import { CERO, porcentaje } from "./dinero.js";
import { mesDe } from "./fechas.js";
import type { Mes, MovimientoCalc, Vista } from "./tipos.js";
import { efectoEnVista } from "./vistas.js";

export interface TotalCategoria {
  categoriaId: string | null;
  total: Decimal;
  cantidad: number;
  /** % sobre el total de gastos del mes. */
  porcentaje: number | null;
}

export interface GastoHormiga {
  categoriaId: string | null;
  cantidad: number;
  total: Decimal;
  promedio: Decimal;
}

export interface ResumenMes {
  mes: Mes;
  ingresos: Decimal;
  gastos: Decimal;
  enviadas: Decimal;
  recibidas: Decimal;
  /** ingresos − gastos + recibidas − enviadas */
  ahorro: Decimal;
  /** ahorro / (ingresos + recibidas), en %; null si no hubo ingresos. */
  tasaAhorro: number | null;
  /** Gastos por categoría raíz, de mayor a menor. */
  porCategoria: TotalCategoria[];
  top5: TotalCategoria[];
  hormiga: GastoHormiga[];
  pendientes: { cantidad: number; ingresos: Decimal; gastos: Decimal };
}

export interface OpcionesResumen {
  mes: Mes;
  vista: Vista;
  /** Devuelve la categoría padre (raíz) de una categoría, para agrupar subcategorías. */
  raiz?: (categoriaId: string) => string;
  /** Gastos hormiga: mínimo de movimientos chicos en una categoría (hoja). */
  hormigaMinCantidad?: number;
  /** Gastos hormiga: promedio máximo por movimiento. */
  hormigaPromedioMaximo?: Decimal;
}

/** Totales del mes (por fecha de impacto) en una vista. Los pendientes no cuentan hasta confirmarse. */
export function resumenMes(movs: MovimientoCalc[], opts: OpcionesResumen): ResumenMes {
  const raiz = opts.raiz ?? ((id: string) => id);
  let ingresos = CERO;
  let gastos = CERO;
  let enviadas = CERO;
  let recibidas = CERO;
  const pendientes = { cantidad: 0, ingresos: CERO, gastos: CERO };
  const porRaiz = new Map<string | null, { total: Decimal; cantidad: number }>();
  const porHoja = new Map<string | null, { total: Decimal; cantidad: number }>();

  for (const m of movs) {
    if (mesDe(m.fechaImpacto) !== opts.mes) continue;
    const efecto = efectoEnVista(m, opts.vista);
    if (!efecto) continue;

    if (m.estado === "pendiente") {
      pendientes.cantidad++;
      if (efecto === "ingreso") pendientes.ingresos = pendientes.ingresos.plus(m.monto);
      if (efecto === "gasto") pendientes.gastos = pendientes.gastos.plus(m.monto);
      continue;
    }

    switch (efecto) {
      case "ingreso":
        ingresos = ingresos.plus(m.monto);
        break;
      case "enviada":
        enviadas = enviadas.plus(m.monto);
        break;
      case "recibida":
        recibidas = recibidas.plus(m.monto);
        break;
      case "gasto": {
        gastos = gastos.plus(m.monto);
        const r = m.categoriaId ? raiz(m.categoriaId) : null;
        acumular(porRaiz, r, m.monto);
        acumular(porHoja, m.categoriaId, m.monto);
        break;
      }
    }
  }

  const porCategoria = [...porRaiz.entries()]
    .map(([categoriaId, v]) => ({ categoriaId, ...v, porcentaje: porcentaje(v.total, gastos) }))
    .sort((a, b) => b.total.comparedTo(a.total));

  const minCantidad = opts.hormigaMinCantidad ?? 6;
  const promedioMax = opts.hormigaPromedioMaximo;
  const hormiga = [...porHoja.entries()]
    .map(([categoriaId, v]) => ({ categoriaId, ...v, promedio: v.total.dividedBy(v.cantidad).toDecimalPlaces(2) }))
    .filter((h) => h.cantidad >= minCantidad && (!promedioMax || h.promedio.lte(promedioMax)))
    .sort((a, b) => b.total.comparedTo(a.total));

  const ahorro = ingresos.minus(gastos).plus(recibidas).minus(enviadas);
  return {
    mes: opts.mes,
    ingresos,
    gastos,
    enviadas,
    recibidas,
    ahorro,
    tasaAhorro: porcentaje(ahorro, ingresos.plus(recibidas)),
    porCategoria,
    top5: porCategoria.slice(0, 5),
    hormiga,
    pendientes,
  };
}

function acumular(map: Map<string | null, { total: Decimal; cantidad: number }>, key: string | null, monto: Decimal) {
  const prev = map.get(key);
  if (prev) {
    prev.total = prev.total.plus(monto);
    prev.cantidad++;
  } else {
    map.set(key, { total: monto, cantidad: 1 });
  }
}

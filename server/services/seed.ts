import { householdSchema, type Household } from "../../seed/schema.js";
import { cuotasRestantes } from "../../shared/domain/cuotas.js";
import { fechaEnMes, mesDe } from "../../shared/domain/fechas.js";
import { VENCIMIENTO_POR_DEFECTO } from "../../shared/domain/impacto.js";
import type { PrismaClient } from "../db.js";
import { deFecha } from "../fechas.js";
import type { Contexto } from "./contexto.js";
import { crearPlanCuotas } from "./cuotas.js";

const PALETA = ["#16a34a", "#2563eb", "#d97706", "#db2777", "#7c3aed", "#0891b2", "#dc2626", "#65a30d", "#ea580c", "#4f46e5", "#0d9488", "#c026d3", "#475569"];

export class SeedError extends Error {}

/** Valida el JSON del hogar y devuelve los errores de referencias (nombres que no existen). */
export function validarHousehold(raw: unknown): Household {
  const r = householdSchema.safeParse(raw);
  if (!r.success) {
    throw new SeedError(r.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n"));
  }
  const h = r.data;
  const errores: string[] = [];
  const personas = new Set(h.personas.map((p) => p.nombre));
  const cuentas = new Set(h.cuentas.map((c) => c.nombre));
  const categorias = new Set(h.categorias.flatMap((c) => [c.nombre, ...c.subcategorias.map((s) => s.nombre)]));
  const repetidas = [...categorias].length !== h.categorias.flatMap((c) => [c.nombre, ...c.subcategorias.map((s) => s.nombre)]).length;
  if (repetidas) errores.push("- categorías: hay nombres repetidos (cada categoría y subcategoría tiene que tener un nombre único)");

  const ref = (conjunto: Set<string>, tipo: string, valor: string | null | undefined, donde: string) => {
    if (valor && !conjunto.has(valor)) errores.push(`- ${donde}: no existe la ${tipo} "${valor}"`);
  };
  h.cuentas.forEach((c) => ref(personas, "persona", c.titular, `cuenta "${c.nombre}"`));
  h.recurrencias.forEach((r) => {
    ref(personas, "persona", r.dueno, `recurrencia "${r.concepto}"`);
    ref(cuentas, "cuenta", r.cuenta, `recurrencia "${r.concepto}"`);
    ref(categorias, "categoría", r.categoria, `recurrencia "${r.concepto}"`);
  });
  h.cuotas.forEach((c) => {
    ref(personas, "persona", c.dueno, `cuotas "${c.descripcion}"`);
    ref(cuentas, "cuenta", c.cuenta, `cuotas "${c.descripcion}"`);
    ref(categorias, "categoría", c.categoria, `cuotas "${c.descripcion}"`);
  });
  h.eventos.forEach((e) => {
    ref(personas, "persona", e.dueno, `evento "${e.nombre}"`);
    ref(categorias, "categoría", e.categoria, `evento "${e.nombre}"`);
  });
  if (errores.length) throw new SeedError(errores.join("\n"));
  return h;
}

/** Carga el hogar en una base vacía. Devuelve avisos (ej. planes de cuotas ya terminados). */
export async function cargarHousehold(p: PrismaClient, h: Household, hoy: string): Promise<string[]> {
  const avisos: string[] = [];
  const inicio = h.inicio ?? mesDe(hoy);

  await p.config.create({ data: { id: 1, nombreHogar: h.hogar.nombre, umbralMargenBajo: h.hogar.umbralMargenBajo } });

  const personas = new Map<string, string>();
  for (const [i, x] of h.personas.entries()) {
    const persona = await p.persona.create({ data: { nombre: x.nombre, email: x.email ?? null, color: x.color ?? PALETA[i % PALETA.length], orden: i } });
    personas.set(x.nombre, persona.id);
  }

  const categorias = new Map<string, string>();
  for (const [i, c] of h.categorias.entries()) {
    const colorCat = c.color ?? PALETA[i % PALETA.length];
    const cat = await p.categoria.create({
      data: { nombre: c.nombre, tipo: c.tipo, icono: c.icono, color: colorCat, ambitoDefault: c.ambito, orden: i },
    });
    categorias.set(c.nombre, cat.id);
    for (const [j, s] of c.subcategorias.entries()) {
      const sub = await p.categoria.create({
        data: { nombre: s.nombre, tipo: c.tipo, padreId: cat.id, icono: s.icono ?? c.icono, color: colorCat, ambitoDefault: s.ambito ?? c.ambito, orden: j },
      });
      categorias.set(s.nombre, sub.id);
    }
  }

  const cuentas = new Map<string, { id: string; tipo: string; diaVencimiento: number | null }>();
  for (const [i, c] of h.cuentas.entries()) {
    const cuenta = await p.cuenta.create({
      data: {
        nombre: c.nombre,
        tipo: c.tipo,
        moneda: c.moneda,
        titularId: personas.get(c.titular)!,
        saldoInicial: c.saldoInicial ?? "0",
        fechaSaldoInicial: c.saldoInicial ? deFecha(`${inicio}-01`) : null,
        tna: c.tna ?? null,
        diaCierre: c.diaCierre ?? null,
        diaVencimiento: c.diaVencimiento ?? null,
        orden: i,
      },
    });
    cuentas.set(c.nombre, { id: cuenta.id, tipo: cuenta.tipo, diaVencimiento: cuenta.diaVencimiento });
  }

  for (const r of h.recurrencias) {
    const categoriaId = r.categoria ? categorias.get(r.categoria)! : null;
    const ambitoCategoria = r.categoria ? ambitoDe(h, r.categoria) : undefined;
    await p.recurrencia.create({
      data: {
        concepto: r.concepto,
        tipo: r.tipo,
        montoEstimado: r.monto,
        montoMin: r.montoMin ?? null,
        montoMax: r.montoMax ?? null,
        moneda: r.moneda,
        frecuencia: r.frecuencia,
        mesAncla: r.mesAncla ?? r.desde ?? inicio,
        diaDelMes: r.dia,
        desde: r.desde ? deFecha(`${r.desde}-01`) : null,
        fechaFin: deFecha(r.hasta ?? null),
        reglaAjuste: r.reglaAjuste ?? null,
        categoriaId,
        duenoId: r.dueno ? personas.get(r.dueno)! : null,
        ambito: r.ambito ?? ambitoCategoria ?? "compartido",
        cuentaId: cuentas.get(r.cuenta)!.id,
        etiquetas: r.etiquetas,
        nota: r.nota ?? null,
        variable: r.variable,
      },
    });
  }

  const ctx = { hoy } as Contexto;
  for (const c of h.cuotas) {
    const cuenta = cuentas.get(c.cuenta)!;
    const duenoId = personas.get(c.dueno ?? h.personas[0].nombre)!;
    let cantidad = c.cantidad;
    let primera: string | null = null;
    if (c.ultimaCuota) {
      cantidad = cuotasRestantes(inicio, c.ultimaCuota);
      if (!cantidad) {
        avisos.push(`Cuotas "${c.descripcion}": la última cuota (${c.ultimaCuota}) es anterior a ${inicio}, no se cargó.`);
        continue;
      }
      const dia = cuenta.tipo === "tarjeta_credito" ? (cuenta.diaVencimiento ?? VENCIMIENTO_POR_DEFECTO) : VENCIMIENTO_POR_DEFECTO;
      primera = fechaEnMes(inicio, dia);
    }
    await crearPlanCuotas(
      p,
      {
        descripcion: c.descripcion,
        montoCuota: c.montoCuota,
        cantidadCuotas: cantidad!,
        cuotasPrevias: 0,
        fechaCompra: primera ? null : c.fechaCompra!,
        primeraFechaImpacto: primera,
        cuentaId: cuenta.id,
        categoriaId: c.categoria ? categorias.get(c.categoria)! : null,
        duenoId,
        ambito: c.ambito ?? null,
      },
      duenoId,
      ctx,
    );
  }

  for (const e of h.eventos) {
    await p.evento.create({
      data: {
        nombre: e.nombre,
        mes: e.mes,
        dia: e.dia ?? null,
        montoPresupuestado: e.monto,
        categoriaId: e.categoria ? categorias.get(e.categoria)! : null,
        duenoId: e.dueno ? personas.get(e.dueno)! : null,
      },
    });
  }

  for (const c of h.cotizaciones) {
    await p.cotizacion.create({ data: { fecha: deFecha(c.fecha), tipo: c.tipo, valor: c.valor } });
  }

  return avisos;
}

function ambitoDe(h: Household, nombre: string) {
  for (const c of h.categorias) {
    if (c.nombre === nombre) return c.ambito;
    const s = c.subcategorias.find((x) => x.nombre === nombre);
    if (s) return s.ambito ?? c.ambito;
  }
  return undefined;
}

/** Borra todos los datos (para re-sembrar). */
export async function vaciarBase(p: PrismaClient) {
  await p.$transaction([
    p.movimiento.deleteMany(),
    p.planCuotas.deleteMany(),
    p.recurrencia.deleteMany(),
    p.evento.deleteMany(),
    p.cotizacion.deleteMany(),
    p.cuenta.deleteMany(),
    p.categoria.updateMany({ data: { padreId: null } }),
    p.categoria.deleteMany(),
    p.persona.deleteMany(),
    p.config.deleteMany(),
  ]);
}

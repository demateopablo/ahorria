import { Hono } from "hono";
import { esFecha } from "../../shared/domain/fechas.js";
import { aiParseInput, type AiParseDTO } from "../../shared/schemas/api.js";
import { cuerpo } from "../http.js";
import { completarJson } from "../llm.js";
import { promptClasificacion, respuestaIa } from "../services/clasificacion.js";
import { cargarContexto } from "../services/contexto.js";
import type { AppEnv } from "../tipos-hono.js";

export const ai = new Hono<AppEnv>();

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Busca por nombre exacto (sin acentos) o, si no, por inclusión. */
function buscar<T extends { id: string; nombre: string }>(lista: T[], nombre: string | null | undefined): string | undefined {
  if (!nombre) return undefined;
  const n = norm(nombre);
  return (lista.find((x) => norm(x.nombre) === n) ?? lista.find((x) => norm(x.nombre).includes(n) || n.includes(norm(x.nombre))))?.id;
}

/**
 * POST /api/ai/parse { texto } → borrador de movimiento. NUNCA guarda nada:
 * el front precarga el formulario y la persona confirma.
 */
ai.post("/parse", async (c) => {
  const p = c.var.p;
  const { texto } = await cuerpo(c, aiParseInput);
  const ctx = await cargarContexto(p);
  const [categorias, cuentas, personas] = await Promise.all([
    p.categoria.findMany({ where: { archivada: false }, include: { padre: { select: { nombre: true } } } }),
    p.cuenta.findMany({ where: { archivada: false } }),
    p.persona.findMany(),
  ]);
  const yo = personas.find((x) => x.id === c.var.sesion.personaId);

  const system = promptClasificacion({
    hoy: ctx.hoy,
    yo: yo?.nombre,
    categorias: categorias.map((x) => ({ nombre: x.nombre, tipo: x.tipo, padre: x.padre?.nombre })),
    cuentas: cuentas.map((x) => x.nombre),
    personas: personas.map((x) => x.nombre),
  });
  // Valida dentro de la cadena: si un proveedor devuelve algo que no encaja, prueba el siguiente.
  const r = await completarJson({ system, user: texto, schema: respuestaIa });
  const monto = r.monto?.replace(/[^\d.]/g, "");
  const etiquetas = r.etiquetas?.map((e) => e.trim().toLowerCase()).filter((e) => e && e.length <= 30).slice(0, 10);

  const borrador: AiParseDTO["borrador"] = {
    tipo: r.tipo,
    monto: monto && /^\d+(\.\d{1,2})?$/.test(monto) && Number(monto) > 0 ? monto : undefined,
    moneda: r.moneda,
    fechaConsumo: r.fecha && esFecha(r.fecha) ? r.fecha : undefined,
    categoriaId: buscar(categorias, r.categoria),
    cuentaId: buscar(cuentas, r.cuenta),
    cuentaDestinoId: r.tipo === "transferencia" ? buscar(cuentas, r.cuentaDestino) : undefined,
    duenoId: buscar(personas, r.dueno),
    ambito: r.ambito ?? undefined,
    etiquetas: etiquetas?.length ? etiquetas : undefined,
    nota: r.nota?.slice(0, 200) || undefined,
    cuotas: r.cuotas ?? undefined,
  };
  // Sin claves undefined en la respuesta.
  return c.json({ borrador: Object.fromEntries(Object.entries(borrador).filter(([, v]) => v !== undefined)) } satisfies AiParseDTO);
});

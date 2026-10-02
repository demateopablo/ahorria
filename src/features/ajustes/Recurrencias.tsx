import { useState } from "react";
import { useHogar } from "@/app/hogar";
import { IconoCategoria } from "@/components/Icono";
import { Aviso, Campo, Cargando, cx, Input, Interruptor, Monto, Segmentado, Select, Tarjeta, Textarea } from "@/components/ui";
import { del, post, put } from "@/lib/api";
import { useRecurrencias } from "@/lib/datos";
import { dec, sumar } from "@shared/domain/dinero";
import { FRECUENCIAS, type Ambito, type Frecuencia, type Moneda } from "@shared/domain/tipos";
import type { RecurrenciaDTO } from "@shared/schemas/api";
import { aTexto, HojaEditor, montoONull, NOMBRE_AMBITO, PantallaAjuste, SelectCategoria, SelectCuenta, useEditor } from "./comun";

const NOMBRE_FRECUENCIA: Record<Frecuencia, string> = { mensual: "Mensual", bimestral: "Bimestral", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual" };

export function Recurrencias() {
  const h = useHogar();
  const { data, isLoading, error } = useRecurrencias();
  const editor = useEditor<RecurrenciaDTO>();
  const ingresos = data?.filter((r) => r.tipo === "ingreso") ?? [];
  const gastos = data?.filter((r) => r.tipo === "gasto") ?? [];
  const totalMensual = sumar(gastos.filter((r) => r.activa).map((r) => dec(r.montoMensual).times(r.moneda === "USD" ? (h.ultimaCotizacion?.valor ?? 0) : 1)));

  return (
    <PantallaAjuste titulo="Fijos" onAgregar={() => editor.abrir()}>
      <p className="text-sm text-ink-2">
        Generan cada mes un movimiento <strong>pendiente de confirmar</strong> (los variables, como el súper, no: esos se cargan compra por compra). La proyección los usa para estimar lo que viene.
      </p>
      {isLoading && <Cargando />}
      {error && <Aviso tono="critical">{error.message}</Aviso>}
      {data && (
        <>
          <Grupo titulo="Ingresos" lista={ingresos} onEditar={editor.abrir} />
          <Grupo titulo="Gastos" lista={gastos} onEditar={editor.abrir} />
          {gastos.length > 0 && (
            <Aviso>
              Los gastos fijos activos equivalen a <Monto valor={totalMensual.toDecimalPlaces(2).toString()} className="font-semibold" /> por mes (prorrateando bimestrales, trimestrales, etc.).
            </Aviso>
          )}
        </>
      )}
      <EditorRecurrencia key={editor.key} abierto={editor.abierto} item={editor.item} onCerrar={editor.cerrar} />
    </PantallaAjuste>
  );
}

function Grupo({ titulo, lista, onEditar }: { titulo: string; lista: RecurrenciaDTO[]; onEditar: (r: RecurrenciaDTO) => void }) {
  const h = useHogar();
  if (!lista.length) return null;
  return (
    <section>
      <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{titulo}</h2>
      <Tarjeta padding="ninguno">
        <ul className="divide-y divide-line">
          {lista.map((r) => {
            const cat = h.categoria(r.categoriaId);
            return (
              <li key={r.id}>
                <button type="button" onClick={() => onEditar(r)} className={cx("flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left", !r.activa && "opacity-50")}>
                  <IconoCategoria icono={cat?.icono} color={cat?.color} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.concepto}</span>
                    <span className="block truncate text-xs text-muted">
                      {r.variable && "Variable · "}
                      {NOMBRE_FRECUENCIA[r.frecuencia]} · día {r.diaDelMes} · {h.cuenta(r.cuentaId)?.nombre}
                      {r.duenoId ? ` · ${h.persona(r.duenoId)?.nombre}` : " · quien pague"}
                      {!r.activa && " · pausado"}
                    </span>
                  </span>
                  <Monto valor={r.montoEstimado} moneda={r.moneda} className={cx("text-sm font-semibold", r.tipo === "ingreso" && "text-ingreso")} />
                </button>
              </li>
            );
          })}
        </ul>
      </Tarjeta>
    </section>
  );
}

function EditorRecurrencia({ abierto, item, onCerrar }: { abierto: boolean; item?: RecurrenciaDTO; onCerrar: () => void }) {
  const h = useHogar();
  const [f, setF] = useState({
    concepto: item?.concepto ?? "",
    tipo: item?.tipo ?? ("gasto" as "gasto" | "ingreso"),
    monto: aTexto(item?.montoEstimado),
    montoMin: aTexto(item?.montoMin),
    montoMax: aTexto(item?.montoMax),
    moneda: item?.moneda ?? ("ARS" as Moneda),
    frecuencia: item?.frecuencia ?? ("mensual" as Frecuencia),
    mesAncla: item?.mesAncla ?? h.hoy.slice(0, 7),
    dia: String(item?.diaDelMes ?? 1),
    desde: item?.desde?.slice(0, 7) ?? "",
    fechaFin: item?.fechaFin ?? "",
    reglaAjuste: item?.reglaAjuste ?? "",
    categoriaId: item?.categoriaId ?? "",
    duenoId: item ? (item.duenoId ?? "") : h.yo.id,
    ambito: item?.ambito ?? ("compartido" as Ambito),
    cuentaId: item?.cuentaId ?? h.cuentasActivas[0]?.id ?? "",
    nota: item?.nota ?? "",
    activa: item?.activa ?? true,
    variable: item?.variable ?? false,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const body = () => ({
    concepto: f.concepto,
    tipo: f.tipo,
    montoEstimado: montoONull(f.monto) ?? "",
    montoMin: montoONull(f.montoMin),
    montoMax: montoONull(f.montoMax),
    moneda: f.moneda,
    frecuencia: f.frecuencia,
    mesAncla: f.mesAncla,
    diaDelMes: Number(f.dia) || 1,
    desde: f.desde ? `${f.desde}-01` : null,
    fechaFin: f.fechaFin || null,
    reglaAjuste: f.reglaAjuste || null,
    categoriaId: f.categoriaId || null,
    duenoId: f.duenoId || null,
    ambito: f.ambito,
    cuentaId: f.cuentaId,
    etiquetas: item?.etiquetas ?? [],
    nota: f.nota || null,
    activa: f.activa,
    variable: f.tipo === "gasto" && f.variable,
  });

  return (
    <HojaEditor
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={item ? "Editar fijo" : "Nuevo fijo"}
      onGuardar={() => (item ? put(`/recurrencias/${item.id}`, body()) : post("/recurrencias", body()))}
      onBorrar={item ? () => del(`/recurrencias/${item.id}`) : undefined}
    >
      <Segmentado
        etiqueta="Tipo"
        valor={f.tipo}
        onChange={(v) => setF((x) => ({ ...x, tipo: v, categoriaId: "" }))}
        opciones={[
          { valor: "gasto", label: "Gasto" },
          { valor: "ingreso", label: "Ingreso" },
        ]}
      />
      <Campo label="Concepto">
        <Input value={f.concepto} onChange={(e) => set("concepto", e.target.value)} placeholder="Ej: Alquiler" />
      </Campo>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Campo label="Monto estimado">
          <Input inputMode="decimal" value={f.monto} onChange={(e) => set("monto", e.target.value)} placeholder="0" />
        </Campo>
        <Campo label="Moneda">
          <Select value={f.moneda} onChange={(e) => set("moneda", e.target.value as Moneda)}>
            <option value="ARS">$</option>
            <option value="USD">US$</option>
          </Select>
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Mínimo (opcional)">
          <Input inputMode="decimal" value={f.montoMin} onChange={(e) => set("montoMin", e.target.value)} />
        </Campo>
        <Campo label="Máximo (opcional)">
          <Input inputMode="decimal" value={f.montoMax} onChange={(e) => set("montoMax", e.target.value)} />
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Frecuencia">
          <Select value={f.frecuencia} onChange={(e) => set("frecuencia", e.target.value as Frecuencia)}>
            {FRECUENCIAS.map((x) => (
              <option key={x} value={x}>
                {NOMBRE_FRECUENCIA[x]}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo label="Día del mes">
          <Input inputMode="numeric" value={f.dia} onChange={(e) => set("dia", e.target.value.replace(/\D/g, "").slice(0, 2))} />
        </Campo>
      </div>
      {f.frecuencia !== "mensual" && (
        <Campo label="Un mes en que toca" ayuda="Con esto se sabe en qué meses cae (ej. aguinaldo: diciembre).">
          <Input type="month" value={f.mesAncla} onChange={(e) => e.target.value && set("mesAncla", e.target.value)} />
        </Campo>
      )}
      <Campo label="Cuenta">
        <SelectCuenta valor={f.cuentaId} onChange={(v) => set("cuentaId", v)} />
      </Campo>
      <Campo label="Categoría">
        <SelectCategoria valor={f.categoriaId} onChange={(v) => set("categoriaId", v)} tipo={f.tipo} />
      </Campo>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="De quién">
          <Select value={f.duenoId} onChange={(e) => set("duenoId", e.target.value)}>
            <option value="">Quien pague</option>
            {h.personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo label="Ámbito">
          <Select value={f.ambito} onChange={(e) => set("ambito", e.target.value as Ambito)}>
            {Object.entries(NOMBRE_AMBITO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Desde (opcional)">
          <Input type="month" value={f.desde} onChange={(e) => set("desde", e.target.value)} />
        </Campo>
        <Campo label="Hasta (opcional)">
          <Input type="date" value={f.fechaFin} onChange={(e) => set("fechaFin", e.target.value)} />
        </Campo>
      </div>
      <Campo label="Regla de ajuste" ayuda="Recordatorio, ej: «ICL trimestral». Por ahora no se aplica sola.">
        <Input value={f.reglaAjuste} onChange={(e) => set("reglaAjuste", e.target.value)} />
      </Campo>
      <Campo label="Nota">
        <Textarea value={f.nota} onChange={(e) => set("nota", e.target.value)} />
      </Campo>
      {f.tipo === "gasto" && (
        <div>
          <Interruptor checked={f.variable} onChange={(v) => set("variable", v)} label="Gasto variable (lo cargo compra por compra)" />
          <p className="text-xs text-muted">
            Para súper, nafta, verdulería… No genera pendientes: la proyección descuenta lo que ya cargaste en la categoría y estima el resto.
          </p>
        </div>
      )}
      <Interruptor checked={f.activa} onChange={(v) => set("activa", v)} label="Activo" />
    </HojaEditor>
  );
}

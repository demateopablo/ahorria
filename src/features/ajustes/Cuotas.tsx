import { useState } from "react";
import { useHogar } from "@/app/hogar";
import { IconoCategoria } from "@/components/Icono";
import { Aviso, Campo, Cargando, Input, Monto, Select, Tarjeta, Vacio } from "@/components/ui";
import { del, patch, post } from "@/lib/api";
import { useCuotas } from "@/lib/datos";
import { sumar } from "@shared/domain/dinero";
import { formatFecha } from "@shared/format";
import type { PlanCuotasDTO } from "@shared/schemas/api";
import { HojaEditor, montoONull, PantallaAjuste, SelectCategoria, SelectCuenta, SelectPersona, useEditor } from "./comun";

export function Cuotas() {
  const h = useHogar();
  const { data, isLoading, error } = useCuotas();
  const editor = useEditor<PlanCuotasDTO>();
  const restanteTotal = sumar((data ?? []).map((p) => p.restante));

  return (
    <PantallaAjuste titulo="Cuotas" onAgregar={() => editor.abrir()}>
      {isLoading && <Cargando />}
      {error && <Aviso tono="critical">{error.message}</Aviso>}
      {data && !data.length && <Vacio imagen="/img/cuotas.webp" titulo="Sin cuotas pendientes" texto="Cuando cargues una compra en cuotas, aparece acá." />}
      {data && data.length > 0 && (
        <>
          <Tarjeta>
            <p className="text-sm text-ink-2">Falta pagar</p>
            <p className="text-3xl font-bold">
              <Monto valor={restanteTotal.toString()} />
            </p>
          </Tarjeta>
          <ul className="space-y-2">
            {data.map((p) => {
              const cat = h.categoria(p.categoriaId);
              const progreso = p.total ? (p.pagadas / p.total) * 100 : 0;
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => editor.abrir(p)} className="w-full text-left">
                    <Tarjeta>
                      <div className="flex items-center gap-3">
                        <IconoCategoria icono={cat?.icono} color={cat?.color} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{p.descripcion}</p>
                          <p className="text-xs text-muted">
                            {h.cuenta(p.cuentaId)?.nombre}
                            {p.proximaFecha && ` · próxima ${formatFecha(p.proximaFecha, true)}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <Monto valor={p.montoCuota} className="block text-sm font-semibold" />
                          <span className="num text-xs text-muted">
                            {p.pagadas}/{p.total}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-bar-track" role="progressbar" aria-valuenow={p.pagadas} aria-valuemin={0} aria-valuemax={p.total} aria-label={`${p.pagadas} de ${p.total} cuotas pagadas`}>
                        <div className="h-2 rounded-full bg-bar" style={{ width: `${Math.max(2, progreso)}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        Falta <Monto valor={p.restante} />
                      </p>
                    </Tarjeta>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <EditorCuotas key={editor.key} abierto={editor.abierto} item={editor.item} onCerrar={editor.cerrar} />
    </PantallaAjuste>
  );
}

function EditorCuotas({ abierto, item, onCerrar }: { abierto: boolean; item?: PlanCuotasDTO; onCerrar: () => void }) {
  const h = useHogar();
  const tarjeta = h.cuentasActivas.find((c) => c.tipo === "tarjeta_credito" && c.titularId === h.yo.id) ?? h.cuentasActivas[0];
  const [f, setF] = useState({
    descripcion: item?.descripcion ?? "",
    montoCuota: "",
    cantidad: "6",
    fechaCompra: h.hoy,
    cuentaId: tarjeta?.id ?? "",
    categoriaId: "",
    duenoId: h.yo.id,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  if (item) {
    // De un plan solo se corrige el nombre; el resto se cancela (se borran las cuotas futuras) y se vuelve a cargar.
    return (
      <HojaEditor
        abierto={abierto}
        onCerrar={onCerrar}
        titulo={item.descripcion}
        onGuardar={() => patch(`/cuotas/${item.id}`, { descripcion: f.descripcion })}
        onBorrar={() => del(`/cuotas/${item.id}`)}
        textoBorrar="Cancelar plan"
      >
        <Campo label="Qué compraste">
          <Input value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} />
        </Campo>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-2">Cuota</dt>
            <dd>
              <Monto valor={item.montoCuota} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-2">Pagadas</dt>
            <dd className="num">
              {item.pagadas} de {item.total}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-2">Falta</dt>
            <dd>
              <Monto valor={item.restante} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-2">Cuenta</dt>
            <dd>{h.cuenta(item.cuentaId)?.nombre}</dd>
          </div>
        </dl>
        <Aviso>Para corregir el monto o las cuotas, cancelalo y cargalo de nuevo. Al cancelarlo se borran las cuotas que todavía no se pagaron; las pagadas quedan.</Aviso>
      </HojaEditor>
    );
  }

  return (
    <HojaEditor
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Nueva compra en cuotas"
      onGuardar={() =>
        post("/cuotas", {
          descripcion: f.descripcion,
          montoCuota: montoONull(f.montoCuota) ?? "",
          cantidadCuotas: Number(f.cantidad),
          fechaCompra: f.fechaCompra,
          cuentaId: f.cuentaId,
          categoriaId: f.categoriaId || null,
          duenoId: f.duenoId,
        })
      }
    >
      <Campo label="Qué compraste">
        <Input value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} placeholder="Ej: Heladera" />
      </Campo>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Valor de cada cuota">
          <Input inputMode="decimal" value={f.montoCuota} onChange={(e) => set("montoCuota", e.target.value)} placeholder="0" />
        </Campo>
        <Campo label="Cuotas">
          <Select value={f.cantidad} onChange={(e) => set("cantidad", e.target.value)}>
            {[2, 3, 4, 5, 6, 9, 10, 12, 18, 24, 36].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Campo>
      </div>
      <Campo label="Fecha de compra" ayuda="Con tarjeta, la primera cuota impacta en el resumen siguiente.">
        <Input type="date" value={f.fechaCompra} onChange={(e) => e.target.value && set("fechaCompra", e.target.value)} />
      </Campo>
      <Campo label="Cuenta">
        <SelectCuenta valor={f.cuentaId} onChange={(v) => set("cuentaId", v)} />
      </Campo>
      <Campo label="Categoría">
        <SelectCategoria valor={f.categoriaId} onChange={(v) => set("categoriaId", v)} tipo="gasto" />
      </Campo>
      <Campo label="De quién">
        <SelectPersona valor={f.duenoId} onChange={(v) => set("duenoId", v)} />
      </Campo>
    </HojaEditor>
  );
}

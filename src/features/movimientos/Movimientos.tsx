import { ArrowLeftRight, ChevronLeft, ChevronRight, CreditCard, Repeat, Undo2, X } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { useHogar } from "@/app/hogar";
import { Encabezado } from "@/app/Layout";
import { Icono, IconoCategoria } from "@/components/Icono";
import { Aviso, Boton, Buscador, Cargando, coincide, cx, Monto, Select, Vacio } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { mensajeError, post } from "@/lib/api";
import { useEscritura, useMovimientos } from "@/lib/datos";
import { formatFecha, formatMes } from "@shared/format";
import { sumarMeses } from "@shared/domain/fechas";
import type { MovimientoDTO } from "@shared/schemas/api";
import { useCarga } from "../carga/Carga";

export function Movimientos() {
  const h = useHogar();
  const abrirCarga = useCarga();
  const [params, setParams] = useSearchParams();
  const mesActual = h.hoy.slice(0, 7);
  const mes = params.get("mes") ?? mesActual;
  const categoria = params.get("categoria") ?? "";
  const cuenta = params.get("cuenta") ?? "";
  // Los omitidos ("este mes no va") no se listan nunca, salvo acá: para poder arrepentirse.
  const descartados = params.get("descartados") === "1";
  const busqueda = params.get("q") ?? "";

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  };

  const { data, isLoading, error } = useMovimientos({ mes, vista: h.vista, categoria, cuenta, estado: descartados ? "omitido" : "" });

  const filtrados = useMemo(
    () =>
      (data ?? []).filter((m) =>
        coincide(busqueda, m.concepto, m.nota, h.categoria(m.categoriaId)?.nombre, h.cuenta(m.cuentaId)?.nombre, h.cuenta(m.cuentaDestinoId)?.nombre, ...m.etiquetas),
      ),
    [data, busqueda, h],
  );

  const porDia = useMemo(() => {
    const grupos = new Map<string, MovimientoDTO[]>();
    for (const m of filtrados) {
      const lista = grupos.get(m.fechaConsumo) ?? [];
      lista.push(m);
      grupos.set(m.fechaConsumo, lista);
    }
    return [...grupos.entries()];
  }, [filtrados]);

  const raices = h.categorias.filter((c) => !c.padreId && !c.archivada);

  return (
    <>
      <Encabezado titulo="Movimientos" />
      <main className="space-y-3 px-4">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => set("mes", sumarMeses(mes, -1))} className="flex size-11 items-center justify-center rounded-full text-ink-2" aria-label="Mes anterior">
            <ChevronLeft size={22} />
          </button>
          <p className="text-base font-semibold capitalize">{formatMes(mes)}</p>
          <button type="button" onClick={() => set("mes", sumarMeses(mes, 1))} className="flex size-11 items-center justify-center rounded-full text-ink-2" aria-label="Mes siguiente">
            <ChevronRight size={22} />
          </button>
        </div>

        <Buscador valor={busqueda} onChange={(v) => set("q", v)} placeholder="Buscar en el mes" />
        <div className="grid grid-cols-2 gap-2">
          <Select value={categoria} onChange={(e) => set("categoria", e.target.value)} aria-label="Filtrar por categoría" className="min-h-11">
            <option value="">Categoría</option>
            {raices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
          <Select value={cuenta} onChange={(e) => set("cuenta", e.target.value)} aria-label="Filtrar por cuenta" className="min-h-11">
            <option value="">Cuenta</option>
            {h.cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </div>
        <button
          type="button"
          aria-pressed={descartados}
          onClick={() => set("descartados", descartados ? "" : "1")}
          className={cx(
            "min-h-11 rounded-full border px-4 text-sm font-medium",
            descartados ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-2",
          )}
        >
          Descartados
        </button>
        {(categoria || cuenta || descartados || busqueda) && (
          <button type="button" className="flex min-h-10 items-center gap-1 text-sm font-medium text-accent" onClick={() => setParams(new URLSearchParams({ mes }), { replace: true })}>
            <X size={16} /> Sacar filtros
          </button>
        )}

        {isLoading && <Cargando />}
        {error && <Aviso tono="critical">{error.message}</Aviso>}
        {data && !filtrados.length && (
          <Vacio
            imagen="/img/vacio.webp"
            titulo="Nada por acá"
            texto={busqueda ? `Nada coincide con "${busqueda}" en ${formatMes(mes)}.` : descartados ? `No descartaste nada en ${formatMes(mes)}.` : "No hay movimientos con estos filtros."}
            accion={mes === mesActual && !categoria && !cuenta && !descartados && !busqueda ? <Boton onClick={() => abrirCarga()}>Cargar uno</Boton> : undefined}
          />
        )}

        {porDia.map(([fecha, movs]) => (
          <section key={fecha}>
            <h2 className="sticky top-[7.5rem] z-10 bg-bg/90 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted backdrop-blur">
              {fecha === h.hoy ? "Hoy" : formatFecha(fecha, true)}
            </h2>
            <ul className="overflow-hidden rounded-3xl bg-surface">
              {movs.map((m) => (
                m.estado === "omitido" ? <FilaDescartada key={m.id} m={m} /> : <Fila key={m.id} m={m} onClick={() => abrirCarga(m)} />
              ))}
            </ul>
          </section>
        ))}
        {data && data.length >= 500 && <Aviso>Se muestran los últimos 500. Usá los filtros para ver el resto.</Aviso>}
      </main>
    </>
  );
}

function Fila({ m, onClick }: { m: MovimientoDTO; onClick: () => void }) {
  const h = useHogar();
  const cat = h.categoria(m.categoriaId);
  const cuenta = h.cuenta(m.cuentaId);
  const esTransferencia = m.tipo === "transferencia";
  const titulo = esTransferencia ? `${cuenta?.nombre} → ${h.cuenta(m.cuentaDestinoId)?.nombre}` : m.concepto || cat?.nombre || "Sin categoría";
  const detalle = [esTransferencia ? "Transferencia" : m.concepto ? cat?.nombre : null, !esTransferencia ? cuenta?.nombre : null, h.personas.length > 1 ? h.persona(m.duenoId)?.nombre : null]
    .filter(Boolean)
    .join(" · ");
  const valor = m.tipo === "ingreso" ? m.monto : esTransferencia ? m.monto : `-${m.monto}`;

  return (
    <li className="border-b border-line last:border-0">
      <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left">
        {esTransferencia ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2">
            <ArrowLeftRight size={20} aria-hidden />
          </span>
        ) : (
          <IconoCategoria icono={cat?.icono} color={cat?.color} />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{titulo}</span>
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted">
            {m.recurrenciaId && <Repeat size={12} className="shrink-0" aria-label="Recurrente" />}
            {m.planCuotasId && <CreditCard size={12} className="shrink-0" aria-label="En cuotas" />}
            <span className="truncate">
              {detalle}
              {m.etiquetas.length > 0 && ` · #${m.etiquetas.join(" #")}`}
            </span>
          </span>
        </span>
        <span className="text-right">
          <Monto
            valor={valor}
            moneda={m.moneda}
            signo={m.tipo === "ingreso" ? "auto" : undefined}
            className={cx("block text-sm font-semibold", m.tipo === "ingreso" && "text-ingreso", esTransferencia && "text-ink-2")}
          />
          {m.estado === "pendiente" && <span className="text-[11px] font-semibold text-warning">Pendiente</span>}
          {m.estado === "confirmado" && m.fechaImpacto.slice(0, 7) !== m.fechaConsumo.slice(0, 7) && (
            <span className="flex items-center justify-end gap-0.5 text-[11px] text-muted">
              <Icono nombre="credit-card" size={11} /> impacta {formatMes(m.fechaImpacto.slice(0, 7), true)}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

/** Un pendiente omitido: se puede devolver a "Para confirmar". */
function FilaDescartada({ m }: { m: MovimientoDTO }) {
  const h = useHogar();
  const toast = useToast();
  const cat = h.categoria(m.categoriaId);
  const recuperar = useEscritura(() => post(`/pendientes/${m.id}/reabrir`));

  async function onRecuperar() {
    try {
      await recuperar.mutateAsync(undefined);
      toast({ texto: `${m.concepto} volvió a "Para confirmar"` });
    } catch (e) {
      toast({ texto: mensajeError(e), error: true });
    }
  }

  return (
    <li className={cx("flex min-h-16 items-center gap-3 border-b border-line px-3 py-2 last:border-0", recuperar.isPending && "opacity-50")}>
      <IconoCategoria icono={cat?.icono} color={cat?.color} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{m.concepto || cat?.nombre}</span>
        <Monto valor={m.monto} moneda={m.moneda} className="text-xs text-muted" />
      </span>
      <button
        type="button"
        onClick={onRecuperar}
        disabled={recuperar.isPending}
        className="flex min-h-11 items-center gap-1 rounded-full bg-accent-soft px-3 text-sm font-semibold text-accent"
      >
        <Undo2 size={16} aria-hidden /> Recuperar
      </button>
    </li>
  );
}

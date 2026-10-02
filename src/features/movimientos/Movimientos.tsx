import { ArrowLeftRight, ChevronLeft, ChevronRight, CreditCard, Repeat, X } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { useHogar } from "@/app/hogar";
import { Encabezado } from "@/app/Layout";
import { Icono, IconoCategoria } from "@/components/Icono";
import { Aviso, Boton, Cargando, cx, Monto, Select, Vacio } from "@/components/ui";
import { useMovimientos } from "@/lib/datos";
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

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  };

  const { data, isLoading, error } = useMovimientos({ mes, vista: h.vista, categoria, cuenta });

  const porDia = useMemo(() => {
    const grupos = new Map<string, MovimientoDTO[]>();
    for (const m of data ?? []) {
      const lista = grupos.get(m.fechaConsumo) ?? [];
      lista.push(m);
      grupos.set(m.fechaConsumo, lista);
    }
    return [...grupos.entries()];
  }, [data]);

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
        {(categoria || cuenta) && (
          <button type="button" className="flex min-h-10 items-center gap-1 text-sm font-medium text-accent" onClick={() => setParams(new URLSearchParams({ mes }), { replace: true })}>
            <X size={16} /> Sacar filtros
          </button>
        )}

        {isLoading && <Cargando />}
        {error && <Aviso tono="critical">{error.message}</Aviso>}
        {data && !data.length && (
          <Vacio
            imagen="/img/vacio.webp"
            titulo="Nada por acá"
            texto="No hay movimientos con estos filtros."
            accion={mes === mesActual && !categoria && !cuenta ? <Boton onClick={() => abrirCarga()}>Cargar uno</Boton> : undefined}
          />
        )}

        {porDia.map(([fecha, movs]) => (
          <section key={fecha}>
            <h2 className="sticky top-[7.5rem] z-10 bg-bg/90 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted backdrop-blur">
              {fecha === h.hoy ? "Hoy" : formatFecha(fecha, true)}
            </h2>
            <ul className="overflow-hidden rounded-3xl bg-surface">
              {movs.map((m) => (
                <Fila key={m.id} m={m} onClick={() => abrirCarga(m)} />
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

import { Check, X } from "lucide-react";
import { useState } from "react";
import { HOGAR, useHogar } from "@/app/hogar";
import { IconoCategoria } from "@/components/Icono";
import { useToast } from "@/components/Toast";
import { cx, Monto, Tarjeta } from "@/components/ui";
import { mensajeError, post } from "@/lib/api";
import { useEscritura, usePendientes } from "@/lib/datos";
import { formatFecha, parseMontoAR } from "@shared/format";
import type { MovimientoDTO } from "@shared/schemas/api";
import { montoATexto } from "../carga/Teclado";

const MAX = 5;

/** Movimientos que generan las recurrencias: se confirman con un toque (editando el monto si cambió). */
export function Pendientes() {
  const h = useHogar();
  const { data } = usePendientes();
  const [todos, setTodos] = useState(false);
  const lista = (data ?? []).filter((m) => h.vista === HOGAR || m.duenoId === h.vista).filter((m) => m.fechaConsumo <= finDeMes(h.hoy));
  if (!lista.length) return null;
  const visibles = todos ? lista : lista.slice(0, MAX);

  return (
    <Tarjeta>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Para confirmar</h2>
        <span className="text-sm text-muted">{lista.length}</span>
      </div>
      <ul className="divide-y divide-line">
        {visibles.map((m) => (
          <FilaPendiente key={m.id} m={m} />
        ))}
      </ul>
      {lista.length > MAX && (
        <button type="button" className="mt-1 min-h-11 w-full text-sm font-semibold text-accent" onClick={() => setTodos(!todos)}>
          {todos ? "Ver menos" : `Ver los ${lista.length}`}
        </button>
      )}
    </Tarjeta>
  );
}

function finDeMes(hoy: string) {
  return `${hoy.slice(0, 7)}-31`;
}

function FilaPendiente({ m }: { m: MovimientoDTO }) {
  const h = useHogar();
  const toast = useToast();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(montoATexto(m.monto));
  const cat = h.categoria(m.categoriaId);

  const confirmar = useEscritura((monto?: string) => post(`/pendientes/${m.id}/confirmar`, monto ? { monto } : {}));
  const omitir = useEscritura(() => post(`/pendientes/${m.id}/omitir`));

  async function onConfirmar() {
    const monto = editando ? parseMontoAR(texto) : null;
    if (editando && !monto) {
      toast({ texto: "Monto inválido", error: true });
      return;
    }
    try {
      await confirmar.mutateAsync(monto ?? undefined);
      toast({ texto: `${m.concepto} confirmado` });
    } catch (e) {
      toast({ texto: mensajeError(e), error: true });
    }
  }

  async function onOmitir() {
    try {
      await omitir.mutateAsync(undefined);
      toast({ texto: `${m.concepto}: este mes no va` });
    } catch (e) {
      toast({ texto: mensajeError(e), error: true });
    }
  }

  const ocupado = confirmar.isPending || omitir.isPending;
  return (
    <li className={cx("flex items-center gap-3 py-2", ocupado && "opacity-50")}>
      <IconoCategoria icono={cat?.icono} color={cat?.color} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{m.concepto}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className="shrink-0">
            {formatFecha(m.fechaConsumo, true)}
            {m.duenoId !== h.yo.id && ` · ${h.persona(m.duenoId)?.nombre}`} ·
          </span>
          {editando ? (
            <input
              autoFocus
              inputMode="decimal"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onConfirmar()}
              aria-label={`Monto real de ${m.concepto}`}
              className="num h-9 w-28 rounded-lg border border-accent bg-surface px-2 text-base text-ink"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="-my-2 min-h-11 text-sm font-semibold text-ink underline decoration-dotted underline-offset-4"
              aria-label={`Editar monto de ${m.concepto}`}
            >
              <Monto valor={m.monto} moneda={m.moneda} signo={m.tipo === "ingreso" ? "auto" : undefined} className={m.tipo === "ingreso" ? "text-ingreso" : undefined} />
            </button>
          )}
        </div>
      </div>
      <button type="button" onClick={onOmitir} disabled={ocupado} className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted" aria-label={`Omitir ${m.concepto} este mes`}>
        <X size={20} />
      </button>
      <button type="button" onClick={onConfirmar} disabled={ocupado} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent" aria-label={`Confirmar ${m.concepto}`}>
        <Check size={22} strokeWidth={2.4} />
      </button>
    </li>
  );
}

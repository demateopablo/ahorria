import { CalendarRange, Home, List, Menu, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router";
import { cx } from "@/components/ui";
import { useCarga } from "@/features/carga/Carga";
import { HOGAR, useHogar } from "./hogar";

export function Layout() {
  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-28">
      <Outlet />
      <BarraInferior />
    </div>
  );
}

/** Encabezado de pantalla con el selector de vista (cada persona + Hogar). */
export function Encabezado({ titulo, derecha }: { titulo: string; derecha?: ReactNode }) {
  const h = useHogar();
  const opciones = [{ id: HOGAR, nombre: "Hogar" }, ...h.personas.map((p) => ({ id: p.id, nombre: p.nombre }))];
  return (
    <header className="pt-safe sticky top-0 z-30 bg-bg/90 px-4 pb-2 backdrop-blur">
      <div className="flex min-h-14 items-center justify-between gap-2 pt-2">
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        {derecha}
      </div>
      {h.personas.length > 1 && (
        <div role="radiogroup" aria-label="Ver las finanzas de" className="scroll-x -mx-4 flex gap-2 px-4">
          {opciones.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={h.vista === o.id}
              onClick={() => h.setVista(o.id)}
              className={cx(
                "min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition",
                h.vista === o.id ? "bg-ink text-bg" : "bg-surface text-ink-2",
              )}
            >
              {o.nombre}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

function BarraInferior() {
  const abrirCarga = useCarga();
  const item = ({ isActive }: { isActive: boolean }) =>
    cx("flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", isActive ? "text-accent" : "text-muted");
  return (
    <nav aria-label="Principal" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center px-2">
        <NavLink to="/" end className={item}>
          <Home size={22} aria-hidden />
          Inicio
        </NavLink>
        <NavLink to="/movimientos" className={item}>
          <List size={22} aria-hidden />
          Movimientos
        </NavLink>
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={() => abrirCarga()}
            aria-label="Cargar movimiento"
            className="-mt-6 flex size-16 items-center justify-center rounded-full bg-accent text-accent-ink shadow-lg shadow-accent/30 active:scale-95"
          >
            <Plus size={30} strokeWidth={2.4} />
          </button>
        </div>
        <NavLink to="/proyeccion" className={item}>
          <CalendarRange size={22} aria-hidden />
          Proyección
        </NavLink>
        <NavLink to="/mas" className={item}>
          <Menu size={22} aria-hidden />
          Más
        </NavLink>
      </div>
    </nav>
  );
}

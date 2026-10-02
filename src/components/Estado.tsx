import { AlertOctagon, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Alerta } from "@shared/domain/proyeccion";
import { cx } from "./ui";

/** Estado de un mes proyectado: siempre ícono + texto, nunca solo color. */
export const ESTADOS: Record<Alerta, { label: string; Icono: typeof CheckCircle2; texto: string; fondo: string; barra: string }> = {
  ok: { label: "Bien", Icono: CheckCircle2, texto: "text-accent", fondo: "bg-accent-soft", barra: "var(--bar)" },
  ambar: { label: "Ajustado", Icono: AlertTriangle, texto: "text-warning", fondo: "bg-warning-soft", barra: "var(--warning-fill)" },
  rojo: { label: "En rojo", Icono: AlertOctagon, texto: "text-critical", fondo: "bg-critical-soft", barra: "var(--critical)" },
};

export function ChipEstado({ alerta, className }: { alerta: Alerta; className?: string }) {
  const e = ESTADOS[alerta];
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", e.fondo, e.texto, className)}>
      <e.Icono size={14} aria-hidden />
      {e.label}
    </span>
  );
}

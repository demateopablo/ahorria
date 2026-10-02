/** Piezas de UI chicas y reutilizables. Todo lo tocable mide ≥ 44 px. */
import { Loader2 } from "lucide-react";
import { twMerge } from "tailwind-merge";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { dec } from "@shared/domain/dinero";
import { formatMonto } from "@shared/format";
import type { Moneda } from "@shared/domain/tipos";

/** Une clases y resuelve conflictos de Tailwind (la última gana: `px-5` + `px-3` → `px-3`). */
export function cx(...c: (string | false | null | undefined)[]) {
  return twMerge(c.filter(Boolean).join(" "));
}

type Variante = "primario" | "secundario" | "fantasma" | "peligro";

export function Boton({
  variante = "primario",
  cargando,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; cargando?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || cargando}
      className={cx(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-base font-semibold transition active:scale-[0.98] disabled:opacity-50",
        variante === "primario" && "bg-accent text-accent-ink",
        variante === "secundario" && "bg-surface-2 text-ink",
        variante === "fantasma" && "text-ink-2",
        variante === "peligro" && "bg-critical-soft text-critical",
        className,
      )}
    >
      {cargando && <Loader2 className="animate-spin" size={18} aria-hidden />}
      {children}
    </button>
  );
}

export function Campo({ label, ayuda, error, children }: { label: string; ayuda?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-2">{label}</span>
      {children}
      {ayuda && !error && <span className="mt-1 block text-xs text-muted">{ayuda}</span>}
      {error && <span className="mt-1 block text-xs text-critical">{error}</span>}
    </label>
  );
}

const claseInput =
  "block min-h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(claseInput, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} {...props} className={cx(claseInput, "py-3", props.className)} />;
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx(claseInput, "appearance-none bg-[length:16px] bg-[right_0.9rem_center] bg-no-repeat pr-9", props.className)} style={{ backgroundImage: FLECHA }}>
      {children}
    </select>
  );
}

const FLECHA = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2376837b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;

/** Selector segmentado (2–4 opciones). */
export function Segmentado<T extends string>({
  opciones,
  valor,
  onChange,
  etiqueta,
}: {
  opciones: { valor: T; label: string }[];
  valor: T;
  onChange: (v: T) => void;
  etiqueta: string;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="grid gap-1 rounded-2xl bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${opciones.length}, 1fr)` }}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={o.valor === valor}
          onClick={() => onChange(o.valor)}
          className={cx(
            "min-h-11 rounded-xl text-sm font-semibold transition",
            o.valor === valor ? "bg-seg-activo text-ink shadow-sm" : "text-ink-2",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Interruptor({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex min-h-12 w-full items-center justify-between gap-3 text-left">
      <span className="text-base text-ink">{label}</span>
      <span className={cx("relative h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-accent" : "bg-line")}>
        <span className={cx("absolute top-0.5 size-6 rounded-full bg-white shadow transition", checked ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

export function Tarjeta({ children, className, padding = "normal" }: { children: ReactNode; className?: string; padding?: "normal" | "chico" | "ninguno" }) {
  return (
    <section
      className={cx(
        "rounded-3xl bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        padding === "normal" && "p-4",
        padding === "chico" && "p-1",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Monto({
  valor,
  moneda = "ARS",
  signo,
  corto,
  className,
}: {
  valor: string | number;
  moneda?: Moneda;
  /** "auto" antepone + a los positivos. */
  signo?: "auto";
  /** Notación compacta para espacios chicos: "$ 1,4 M", "$ 254,7 mil". */
  corto?: boolean;
  className?: string;
}) {
  const d = dec(valor);
  const n = d.toNumber();
  const texto = corto ? compacto(moneda).format(Math.abs(n)) : formatMonto(d.abs(), moneda, { compacto: true });
  const pref = n < 0 ? "−" : signo === "auto" && n > 0 ? "+" : "";
  return <span className={cx("num whitespace-nowrap", className)}>{`${pref}${texto}`}</span>;
}

const formatosCortos = new Map<Moneda, Intl.NumberFormat>();
function compacto(moneda: Moneda) {
  let f = formatosCortos.get(moneda);
  if (!f) {
    f = new Intl.NumberFormat("es-AR", { style: "currency", currency: moneda, notation: "compact", maximumFractionDigits: 1 });
    formatosCortos.set(moneda, f);
  }
  return f;
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-muted">
      <Loader2 className="animate-spin" size={20} aria-hidden />
      <span>{texto}</span>
    </div>
  );
}

export function Aviso({ tono = "info", children }: { tono?: "info" | "warning" | "critical"; children: ReactNode }) {
  return (
    <div
      role={tono === "critical" ? "alert" : "status"}
      className={cx(
        "rounded-2xl px-4 py-3 text-sm",
        tono === "info" && "bg-surface-2 text-ink-2",
        tono === "warning" && "bg-warning-soft text-ink",
        tono === "critical" && "bg-critical-soft text-ink",
      )}
    >
      {children}
    </div>
  );
}

/** Estado vacío con una foto (Unsplash, ver CREDITS.md) y una acción opcional. */
export function Vacio({ imagen, titulo, texto, accion }: { imagen?: string; titulo: string; texto?: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-8 text-center">
      {imagen && <img src={imagen} alt="" className="mb-5 h-40 w-full max-w-xs rounded-3xl object-cover" loading="lazy" />}
      <p className="text-lg font-semibold text-ink">{titulo}</p>
      {texto && <p className="mt-1 max-w-xs text-sm text-ink-2">{texto}</p>}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  );
}

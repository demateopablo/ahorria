import { ChevronLeft, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useHogar } from "@/app/hogar";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { Boton, Select } from "@/components/ui";
import { mensajeError } from "@/lib/api";
import { useEscritura } from "@/lib/datos";
import type { Ambito } from "@shared/domain/tipos";

export const NOMBRE_AMBITO: Record<Ambito, string> = { personal: "Personal", compartido: "Compartido", negocio: "Negocio", familia: "Familia" };
export const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** Pantalla de ajustes: volver + título + botón agregar. */
export function PantallaAjuste({ titulo, onAgregar, children }: { titulo: string; onAgregar?: () => void; children: ReactNode }) {
  return (
    <>
      <header className="pt-safe sticky top-0 z-30 flex min-h-16 items-center gap-1 bg-bg/90 px-2 backdrop-blur">
        <Link to="/mas" className="flex size-11 items-center justify-center rounded-full text-ink-2" aria-label="Volver">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="flex-1 text-xl font-bold">{titulo}</h1>
        {onAgregar && (
          <button type="button" onClick={onAgregar} className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-ink" aria-label="Agregar">
            <Plus size={22} />
          </button>
        )}
      </header>
      <main className="space-y-3 px-4 pb-6">{children}</main>
    </>
  );
}

/**
 * Hoja de edición genérica: maneja abrir/cerrar, guardar y borrar con errores legibles.
 * `T` es el ítem que se edita (undefined = nuevo).
 */
export function useEditor<T>() {
  const [estado, setEstado] = useState<{ abierto: boolean; item?: T; key: number }>({ abierto: false, key: 0 });
  return {
    ...estado,
    abrir: (item?: T) => setEstado((e) => ({ abierto: true, item, key: e.key + 1 })),
    cerrar: () => setEstado((e) => ({ ...e, abierto: false })),
  };
}

export function HojaEditor({
  abierto,
  onCerrar,
  titulo,
  onGuardar,
  onBorrar,
  textoBorrar = "Borrar",
  children,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  /** Sin onGuardar la hoja es de solo lectura (con borrar opcional). */
  onGuardar?: () => Promise<unknown>;
  onBorrar?: () => Promise<unknown>;
  textoBorrar?: string;
  children: ReactNode;
}) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const guardar = useEscritura(async () => onGuardar?.());
  const borrar = useEscritura(async () => onBorrar?.());

  async function ejecutar(m: typeof guardar, ok: string) {
    setError(null);
    try {
      await m.mutateAsync(undefined);
      toast({ texto: ok });
      onCerrar();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  return (
    <Sheet
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={titulo}
      completo
      pie={
        <div className="flex gap-2">
          {onBorrar && (
            <Boton variante="peligro" className={onGuardar ? undefined : "flex-1"} cargando={borrar.isPending} onClick={() => (confirmar ? ejecutar(borrar, "Listo, borrado") : setConfirmar(true))}>
              {confirmar ? "¿Seguro?" : textoBorrar}
            </Boton>
          )}
          {onGuardar && (
            <Boton className="flex-1" cargando={guardar.isPending} onClick={() => ejecutar(guardar, "Guardado")}>
              Guardar
            </Boton>
          )}
        </div>
      }
    >
      <div className="space-y-4 pt-2">
        {children}
        {error && (
          <p role="alert" className="rounded-xl bg-critical-soft px-3 py-2 text-sm text-ink">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

/** Select de categorías agrupado por categoría madre. */
export function SelectCategoria({
  valor,
  onChange,
  tipo,
  vacio = "Sin categoría",
  soloRaices,
}: {
  valor: string;
  onChange: (id: string) => void;
  tipo?: "gasto" | "ingreso";
  vacio?: string;
  soloRaices?: boolean;
}) {
  const h = useHogar();
  const raices = h.categorias.filter((c) => !c.padreId && (!tipo || c.tipo === tipo) && (!c.archivada || c.id === valor));
  return (
    <Select value={valor} onChange={(e) => onChange(e.target.value)}>
      <option value="">{vacio}</option>
      {raices.map((r) => {
        const hijas = soloRaices ? [] : h.categorias.filter((c) => c.padreId === r.id && (!c.archivada || c.id === valor));
        return hijas.length ? (
          <optgroup key={r.id} label={r.nombre}>
            <option value={r.id}>{r.nombre} (general)</option>
            {hijas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </optgroup>
        ) : (
          <option key={r.id} value={r.id}>
            {r.nombre}
          </option>
        );
      })}
    </Select>
  );
}

export function SelectPersona({ valor, onChange, vacio }: { valor: string; onChange: (id: string) => void; vacio?: string }) {
  const h = useHogar();
  return (
    <Select value={valor} onChange={(e) => onChange(e.target.value)}>
      {vacio !== undefined && <option value="">{vacio}</option>}
      {h.personas.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nombre}
        </option>
      ))}
    </Select>
  );
}

export function SelectCuenta({ valor, onChange }: { valor: string; onChange: (id: string) => void }) {
  const h = useHogar();
  return (
    <Select value={valor} onChange={(e) => onChange(e.target.value)}>
      {h.cuentas
        .filter((c) => !c.archivada || c.id === valor)
        .map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
    </Select>
  );
}

/** Texto argentino ("1.234,5") → "1234.5" para la API; vacío → null. */
export function montoONull(texto: string): string | null {
  const t = texto.trim();
  if (!t) return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, "") : t;
  return normal;
}

/** "1234.5" → "1234,5" para editar. */
export const aTexto = (v: string | null | undefined) => (v ? v.replace(".", ",") : "");

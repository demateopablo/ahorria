import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "./ui";

/**
 * Hace que el botón "atrás" del celular cierre la hoja en lugar de salir de la pantalla.
 * Al abrir empuja una entrada al historial; al cerrar por la UI la saca.
 */
function useAtrasCierra(abierto: boolean, cerrar: () => void) {
  const cerrarRef = useRef(cerrar);
  const marcaRef = useRef<string | null>(null);
  const atrasPendiente = useRef<number | undefined>(undefined);
  useEffect(() => {
    cerrarRef.current = cerrar;
  });
  useEffect(() => {
    if (!abierto) return;
    let marca: string;
    if (atrasPendiente.current !== undefined && marcaRef.current) {
      // Desmontaje y montaje inmediato (StrictMode): se reutiliza la misma entrada del historial.
      clearTimeout(atrasPendiente.current);
      atrasPendiente.current = undefined;
      marca = marcaRef.current;
    } else {
      marca = `sheet-${Math.random().toString(36).slice(2)}`;
      marcaRef.current = marca;
      history.pushState({ ...history.state, sheet: marca }, "");
    }
    let porAtras = false;
    const onPop = () => {
      // Si el historial volvió a NUESTRA entrada, se cerró una hoja anidada encima: seguimos abiertos.
      if (history.state?.sheet === marca) return;
      porAtras = true;
      cerrarRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (porAtras || history.state?.sheet !== marca) return;
      // Diferido un tick: si el efecto se vuelve a montar enseguida, se cancela.
      atrasPendiente.current = window.setTimeout(() => {
        atrasPendiente.current = undefined;
        if (history.state?.sheet === marca) history.back();
      }, 0);
    };
  }, [abierto]);
}

export function Sheet({
  abierto,
  onCerrar,
  titulo,
  children,
  pie,
  completo,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: ReactNode;
  /** Acciones fijas abajo (ej. Guardar). */
  pie?: ReactNode;
  /** Ocupa toda la pantalla en el celular. */
  completo?: boolean;
}) {
  useAtrasCierra(abierto, onCerrar);
  return (
    <Dialog.Root open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-fade fixed inset-0 z-40 bg-overlay" />
        <Dialog.Content
          aria-describedby={undefined}
          // Tocar la acción de un toast (ej. "Elegir") no es tocar afuera: no cierra la hoja.
          onInteractOutside={(e) => e.target instanceof Element && e.target.closest("[data-toast]") && e.preventDefault()}
          className={cx(
            "anim-sheet fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-lg flex-col rounded-t-3xl bg-bg sm:bottom-6 sm:rounded-3xl",
            completo ? "top-0 rounded-t-none sm:top-6 sm:rounded-t-3xl" : "max-h-[92dvh]",
          )}
        >
          <div className="pt-safe flex items-center justify-between gap-2 px-4 pb-1 pt-3">
            <Dialog.Title className="text-lg font-semibold">{titulo}</Dialog.Title>
            <Dialog.Close className="-mr-2 flex size-11 items-center justify-center rounded-full text-ink-2" aria-label="Cerrar">
              <X size={22} />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
          {pie && <div className="pb-safe border-t border-line bg-bg px-4 pt-3 [&>*]:mb-3">{pie}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

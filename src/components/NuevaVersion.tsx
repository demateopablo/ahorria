import { useRegisterSW } from "virtual:pwa-register/react";
import { Boton } from "./ui";

/** Aviso cuando hay una versión nueva de la app instalada (service worker en espera). */
export function NuevaVersion() {
  const {
    needRefresh: [hayNueva, setHayNueva],
    updateServiceWorker,
  } = useRegisterSW();
  if (!hayNueva) return null;
  return (
    <div role="status" className="anim-sheet fixed inset-x-4 top-4 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink p-3 pl-4 text-sm text-bg shadow-lg">
      <span className="flex-1">Hay una versión nueva de Ahorria.</span>
      <Boton variante="secundario" className="min-h-10 px-3 text-sm" onClick={() => setHayNueva(false)}>
        Después
      </Boton>
      <Boton className="min-h-10 px-3 text-sm" onClick={() => updateServiceWorker(true)}>
        Actualizar
      </Boton>
    </div>
  );
}

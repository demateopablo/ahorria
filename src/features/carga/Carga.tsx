import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { hayAtajoCarga, olvidarAtajo } from "@/lib/atajo";
import { Sheet } from "@/components/Sheet";
import type { MovimientoDTO } from "@shared/schemas/api";
import { MovimientoForm } from "./MovimientoForm";

const Ctx = createContext<(mov?: MovimientoDTO) => void>(() => {});

/** Hoja de carga/edición de movimientos, disponible en toda la app. */
export function CargaProvider({ children }: { children: ReactNode }) {
  // Atajo del ícono de la app instalada (/?cargar=1, ver lib/atajo.ts): arranca con la hoja abierta.
  const [estado, setEstado] = useState<{ abierto: boolean; mov?: MovimientoDTO; key: number }>(() => ({ abierto: hayAtajoCarga(), key: 0 }));
  useEffect(olvidarAtajo, []);

  const abrir = useCallback((mov?: MovimientoDTO) => setEstado((e) => ({ abierto: true, mov, key: e.key + 1 })), []);
  const cerrar = useCallback(() => setEstado((e) => ({ ...e, abierto: false })), []);

  return (
    <Ctx.Provider value={abrir}>
      {children}
      <Sheet abierto={estado.abierto} onCerrar={cerrar} titulo={estado.mov ? "Editar movimiento" : "Nuevo movimiento"} completo>
        <MovimientoForm key={estado.key} inicial={estado.mov} onListo={cerrar} />
      </Sheet>
    </Ctx.Provider>
  );
}

export const useCarga = () => useContext(Ctx);

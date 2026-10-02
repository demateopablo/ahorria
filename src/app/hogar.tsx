import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { BootstrapDTO, CategoriaDTO, CuentaDTO, PersonaDTO } from "@shared/schemas/api";

export const HOGAR = "hogar";

interface Hogar extends BootstrapDTO {
  persona: (id: string | null | undefined) => PersonaDTO | undefined;
  cuenta: (id: string | null | undefined) => CuentaDTO | undefined;
  categoria: (id: string | null | undefined) => CategoriaDTO | undefined;
  /** Categoría raíz (padre) de una categoría. */
  raiz: (id: string | null | undefined) => CategoriaDTO | undefined;
  /** Nombre "Padre › Hija" para listados. */
  nombreCategoria: (id: string | null | undefined) => string;
  cuentasActivas: CuentaDTO[];
  vista: string;
  setVista: (v: string) => void;
  nombreVista: string;
}

const Ctx = createContext<Hogar | null>(null);

const CLAVE_VISTA = "ahorria:vista";

function leerVista(): string {
  try {
    return localStorage.getItem(CLAVE_VISTA) ?? HOGAR;
  } catch {
    return HOGAR;
  }
}

export function HogarProvider({ datos, children }: { datos: BootstrapDTO; children: ReactNode }) {
  const [vistaGuardada, setVistaState] = useState(leerVista);
  const vista = vistaGuardada === HOGAR || datos.personas.some((p) => p.id === vistaGuardada) ? vistaGuardada : HOGAR;

  const valor = useMemo<Hogar>(() => {
    const personas = new Map(datos.personas.map((p) => [p.id, p]));
    const cuentas = new Map(datos.cuentas.map((c) => [c.id, c]));
    const categorias = new Map(datos.categorias.map((c) => [c.id, c]));
    const categoria = (id: string | null | undefined) => (id ? categorias.get(id) : undefined);
    const raiz = (id: string | null | undefined) => {
      const c = categoria(id);
      return c?.padreId ? (categoria(c.padreId) ?? c) : c;
    };
    return {
      ...datos,
      persona: (id) => (id ? personas.get(id) : undefined),
      cuenta: (id) => (id ? cuentas.get(id) : undefined),
      categoria,
      raiz,
      nombreCategoria: (id) => {
        const c = categoria(id);
        if (!c) return "Sin categoría";
        const padre = categoria(c.padreId);
        return padre ? `${padre.nombre} › ${c.nombre}` : c.nombre;
      },
      cuentasActivas: datos.cuentas.filter((c) => !c.archivada),
      vista,
      setVista: (v: string) => {
        setVistaState(v);
        try {
          localStorage.setItem(CLAVE_VISTA, v);
        } catch {
          // almacenamiento bloqueado: la vista vive solo en memoria
        }
      },
      nombreVista: vista === HOGAR ? "Hogar" : (personas.get(vista)?.nombre ?? "Hogar"),
    };
  }, [datos, vista]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useHogar(): Hogar {
  const h = useContext(Ctx);
  if (!h) throw new Error("useHogar fuera de HogarProvider");
  return h;
}

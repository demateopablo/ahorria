import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface Toast {
  id: number;
  texto: string;
  accion?: { label: string; fn: () => void };
  error?: boolean;
}

const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const mostrar = useCallback((t: Omit<Toast, "id">) => {
    clearTimeout(timer.current);
    setToast({ ...t, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), t.accion ? 6000 : 3000);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <Ctx.Provider value={mostrar}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4">
        {toast && (
          <div
            key={toast.id}
            // Lo usa Sheet para no cerrarse al tocar la acción (marca en el toast mismo: al click ya está desmontado).
            data-toast
            role={toast.error ? "alert" : "status"}
            className="anim-sheet pointer-events-auto flex min-h-12 max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-2 text-sm text-bg shadow-lg"
          >
            <span className="flex-1">{toast.texto}</span>
            {toast.accion && (
              <button
                type="button"
                className="min-h-11 rounded-xl px-2 font-semibold text-accent-soft"
                onClick={() => {
                  toast.accion!.fn();
                  setToast(null);
                }}
              >
                {toast.accion.label}
              </button>
            )}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

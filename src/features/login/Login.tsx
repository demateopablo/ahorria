import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { Aviso, Boton } from "@/components/ui";
import { ApiError, get, mensajeError, post } from "@/lib/api";
import type { PersonaDTO } from "@shared/schemas/api";

/** Tipado mínimo de Google Identity Services (script cargado en index.html). */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
          renderButton: (el: HTMLElement, options: Record<string, string | number>) => void;
        };
      };
    };
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

interface Opciones {
  google: boolean;
  dev: boolean;
  personas: PersonaDTO[];
}

export function Login() {
  const qc = useQueryClient();
  const boton = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const { data: opciones } = useQuery({ queryKey: ["auth-opciones"], queryFn: () => get<Opciones>("/auth/opciones") });

  const entrar = async (fn: () => Promise<{ persona: PersonaDTO }>) => {
    setOcupado(true);
    setError(null);
    try {
      const { persona } = await fn();
      qc.setQueryData(["sesion"], persona);
      await qc.invalidateQueries();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : mensajeError(e));
    } finally {
      setOcupado(false);
    }
  };

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelado = false;
    const intentar = () => {
      if (cancelado) return;
      const gis = window.google?.accounts.id;
      if (!gis || !boton.current) {
        setTimeout(intentar, 100);
        return;
      }
      gis.initialize({
        client_id: CLIENT_ID,
        callback: ({ credential }) => entrar(() => post("/auth/login", { credential })),
      });
      const oscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
      gis.renderButton(boton.current, { theme: oscuro ? "filled_black" : "outline", size: "large", text: "continue_with", shape: "pill", locale: "es", width: 300 });
    };
    intentar();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="relative h-[42dvh] overflow-hidden rounded-b-[2.5rem]">
        <img src="/img/login.webp" alt="" className="size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/10 to-transparent" />
      </div>
      <div className="relative z-10 -mt-10 flex flex-1 flex-col px-6 pb-10">
        <Logo className="size-14 drop-shadow-md" />
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Ahorria</h1>
        <p className="mt-2 text-base text-ink-2">Las finanzas de tu hogar, ordenadas: lo que entra, lo que sale y lo que viene.</p>

        <div className="mt-8 flex min-h-12 flex-col items-center gap-3">
          {CLIENT_ID ? (
            // color-scheme claro: si no coincide con el del iframe de Google, Chrome le pinta fondo blanco.
            <div ref={boton} style={{ colorScheme: "light" }} />
          ) : !opciones?.dev && <Aviso tono="warning">Falta configurar el login con Google (VITE_GOOGLE_CLIENT_ID). Mirá el README.</Aviso>}
          {opciones?.dev && opciones.personas.length > 0 && (
            <div className="w-full space-y-2 rounded-3xl bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Modo desarrollo</p>
              {opciones.personas.map((p) => (
                <Boton key={p.id} variante="secundario" className="w-full" disabled={ocupado} onClick={() => entrar(() => post("/auth/dev-login", { personaId: p.id }))}>
                  Entrar como {p.nombre}
                </Boton>
              ))}
            </div>
          )}
          {ocupado && <p className="text-sm text-ink-2">Entrando…</p>}
          {error && <Aviso tono="critical">{error}</Aviso>}
        </div>
      </div>
    </main>
  );
}

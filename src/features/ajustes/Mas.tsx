import { CalendarHeart, ChevronRight, CreditCard, DollarSign, Home, LogOut, Repeat, Sparkles, Tags, Users, Wallet } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { useHogar } from "@/app/hogar";
import { Tarjeta } from "@/components/ui";
import { post } from "@/lib/api";

const SECCIONES = [
  { to: "/mas/recurrencias", label: "Gastos e ingresos fijos", detalle: "Sueldo, alquiler, servicios…", Icono: Repeat },
  { to: "/mas/cuotas", label: "Compras en cuotas", detalle: "Lo que ya está comprometido", Icono: CreditCard },
  { to: "/mas/eventos", label: "Eventos y regalos", detalle: "Cumpleaños, fiestas…", Icono: CalendarHeart },
  { to: "/mas/cuentas", label: "Cuentas y tarjetas", detalle: "Billeteras, bancos, efectivo", Icono: Wallet },
  { to: "/mas/categorias", label: "Categorías", detalle: "Íconos, colores, subcategorías", Icono: Tags },
  { to: "/mas/personas", label: "Personas", detalle: "Quiénes forman el hogar", Icono: Users },
  { to: "/mas/cotizaciones", label: "Dólar", detalle: "Se actualiza solo todos los días", Icono: DollarSign },
  { to: "/mas/hogar", label: "Hogar", detalle: "Nombre y margen mínimo", Icono: Home },
];

export function Mas() {
  const h = useHogar();
  const qc = useQueryClient();

  async function salir() {
    await post("/auth/logout").catch(() => {});
    qc.clear();
    window.location.href = "/";
  }

  return (
    <>
      <header className="pt-safe px-4 pb-2">
        <h1 className="min-h-14 pt-4 text-2xl font-bold tracking-tight">Más</h1>
      </header>
      <main className="space-y-3 px-4">
        <Tarjeta padding="chico">
          <ul>
            {SECCIONES.map((s) => (
              <li key={s.to}>
                <Link to={s.to} className="flex min-h-16 items-center gap-3 rounded-2xl px-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-ink-2">
                    <s.Icono size={20} aria-hidden />
                  </span>
                  <span className="flex-1">
                    <span className="block text-base font-medium">{s.label}</span>
                    <span className="block text-xs text-muted">{s.detalle}</span>
                  </span>
                  <ChevronRight size={20} className="text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2">
              <Sparkles size={20} aria-hidden />
            </span>
            <div className="text-sm">
              <p className="text-base font-medium">Carga con IA {h.ia ? "activada" : "desactivada"}</p>
              {h.ia ? (
                <p className="text-ink-2">Podés escribir «super 45 mil con MP» arriba del teclado al cargar un gasto.</p>
              ) : (
                <p className="text-ink-2">
                  La API key no se carga desde la app (sería un secreto guardado en la base): se configura como variable de entorno del servidor
                  (<code>LLM_API_KEY</code>, <code>LLM_BASE_URL</code> y <code>LLM_MODEL</code> en Vercel). Instrucciones en el README.
                </p>
              )}
            </div>
          </div>
        </Tarjeta>
        <Tarjeta padding="chico">
          <button type="button" onClick={salir} className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left text-critical">
            <LogOut size={20} aria-hidden />
            <span className="flex-1">
              Cerrar sesión
              <span className="block text-xs text-muted">{h.yo.email}</span>
            </span>
          </button>
        </Tarjeta>
        <p className="pb-4 text-center text-xs text-muted">
          Ahorria · código abierto ·{" "}
          <a href="https://github.com/demateopablo/ahorria" className="underline" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </p>
      </main>
    </>
  );
}

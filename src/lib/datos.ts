/** Hooks de datos (TanStack Query). Toda escritura invalida lo que puede haber cambiado. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BootstrapDTO,
  CotizacionDTO,
  DashboardDTO,
  EventoDTO,
  MovimientoDTO,
  PersonaDTO,
  PlanCuotasDTO,
  ProyeccionDTO,
  RecurrenciaDTO,
} from "@shared/schemas/api";
import { get } from "./api";

export const claves = {
  bootstrap: ["bootstrap"] as const,
  dashboard: (vista: string, mes: string) => ["dashboard", vista, mes] as const,
  proyeccion: (vista: string, meses: number) => ["proyeccion", vista, meses] as const,
  movimientos: (filtros: Record<string, string>) => ["movimientos", filtros] as const,
  pendientes: ["pendientes"] as const,
  recurrencias: ["recurrencias"] as const,
  cuotas: ["cuotas"] as const,
  eventos: ["eventos"] as const,
  cotizaciones: ["cotizaciones"] as const,
};

export function useSesion() {
  return useQuery({
    queryKey: ["sesion"],
    queryFn: () => get<{ persona: PersonaDTO | null }>("/auth/me").then((r) => r.persona),
    retry: false,
    staleTime: Infinity,
  });
}

export function useBootstrap() {
  return useQuery({ queryKey: claves.bootstrap, queryFn: () => get<BootstrapDTO>("/bootstrap"), staleTime: 60_000 });
}

export function useDashboard(vista: string, mes: string) {
  return useQuery({
    queryKey: claves.dashboard(vista, mes),
    queryFn: () => get<DashboardDTO>(`/dashboard?mes=${mes}&vista=${encodeURIComponent(vista)}`),
    placeholderData: (prev) => prev,
  });
}

export function useProyeccion(vista: string, meses = 6) {
  return useQuery({
    queryKey: claves.proyeccion(vista, meses),
    queryFn: () => get<ProyeccionDTO>(`/proyeccion?meses=${meses}&vista=${encodeURIComponent(vista)}`),
    placeholderData: (prev) => prev,
  });
}

export function useMovimientos(filtros: Record<string, string>) {
  const qs = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v)).toString();
  return useQuery({
    queryKey: claves.movimientos(filtros),
    queryFn: () => get<{ movimientos: MovimientoDTO[] }>(`/movimientos?${qs}`).then((r) => r.movimientos),
    placeholderData: (prev) => prev,
  });
}

export function usePendientes() {
  return useQuery({ queryKey: claves.pendientes, queryFn: () => get<{ movimientos: MovimientoDTO[] }>("/pendientes").then((r) => r.movimientos) });
}

export function useRecurrencias() {
  return useQuery({ queryKey: claves.recurrencias, queryFn: () => get<{ recurrencias: RecurrenciaDTO[] }>("/recurrencias").then((r) => r.recurrencias) });
}

export function useCuotas() {
  return useQuery({ queryKey: claves.cuotas, queryFn: () => get<{ planes: PlanCuotasDTO[] }>("/cuotas").then((r) => r.planes) });
}

export function useEventos() {
  return useQuery({ queryKey: claves.eventos, queryFn: () => get<{ eventos: EventoDTO[] }>("/eventos").then((r) => r.eventos) });
}

export function useCotizaciones() {
  return useQuery({ queryKey: claves.cotizaciones, queryFn: () => get<{ cotizaciones: CotizacionDTO[] }>("/cotizaciones").then((r) => r.cotizaciones) });
}

/** Mutación que, al terminar bien, invalida todo lo que depende de los movimientos. */
export function useEscritura<TArgs, TRes>(fn: (args: TArgs) => Promise<TRes>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "sesion" }),
  });
}

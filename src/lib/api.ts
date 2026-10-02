/** Cliente de la API: JSON, cookie de sesión y errores legibles. */

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Metodo = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Se llama cuando la API responde 401 (la sesión venció o la sacaron del hogar). */
let alPerderSesion: () => void = () => {};
export function onSesionPerdida(fn: () => void) {
  alPerderSesion = fn;
}

export async function api<T>(metodo: Metodo, ruta: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${ruta}`, {
      method: metodo,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Sin conexión. Revisá internet y probá de nuevo.");
  }
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    if (res.status === 401 && !ruta.startsWith("/auth/")) alPerderSesion();
    throw new ApiError(res.status, data?.error ?? `Error ${res.status}`);
  }
  return data as T;
}

export const get = <T,>(ruta: string) => api<T>("GET", ruta);
export const post = <T,>(ruta: string, body?: unknown) => api<T>("POST", ruta, body ?? {});
export const put = <T,>(ruta: string, body: unknown) => api<T>("PUT", ruta, body);
export const patch = <T,>(ruta: string, body: unknown) => api<T>("PATCH", ruta, body);
export const del = <T,>(ruta: string) => api<T>("DELETE", ruta);

export function mensajeError(e: unknown): string {
  return e instanceof Error ? e.message : "Algo salió mal";
}

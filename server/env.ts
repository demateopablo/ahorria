import { proveedores } from "./llm.js";

/** Lectura de variables de entorno con error claro si falta alguna. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

/** Login sin Google: solo en local, nunca en Vercel ni en producción. */
export function devLoginHabilitado(): boolean {
  return process.env.ALLOW_DEV_LOGIN === "true" && !process.env.VERCEL && process.env.NODE_ENV !== "production";
}

export function iaHabilitada(): boolean {
  return proveedores().length > 0;
}

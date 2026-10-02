import { SignJWT, jwtVerify } from "jose";
import { requireEnv } from "../env.js";

const COOKIE = "ahorria_session";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const secret = () => new TextEncoder().encode(requireEnv("SESSION_SECRET"));

export interface Session {
  personaId: string;
  email: string;
}

export async function crearCookieSesion(s: Session): Promise<string> {
  const token = await new SignJWT({ email: s.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.personaId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
  // Path=/api: la cookie solo viaja a la API, nunca a los assets.
  return `${COOKIE}=${token}; Path=/api; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function borrarCookieSesion(): string {
  return `${COOKIE}=; Path=/api; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function leerCookie(header: string | null | undefined): string | null {
  for (const part of (header ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) return rest.join("=");
  }
  return null;
}

export async function leerSesion(cookieHeader: string | null | undefined): Promise<Session | null> {
  const token = leerCookie(cookieHeader);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    return { personaId: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

import { OAuth2Client } from "google-auth-library";
import { requireEnv } from "../env.js";
import { HttpError } from "../http.js";

let cliente: OAuth2Client | undefined;

/** Verifica el ID token de Google Identity Services y devuelve el email verificado (en minúsculas). */
export async function verificarTokenGoogle(credential: string): Promise<string> {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  cliente ??= new OAuth2Client(clientId);
  let payload;
  try {
    const ticket = await cliente.verifyIdToken({ idToken: credential, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    throw new HttpError(401, "Token de Google inválido");
  }
  const email = payload?.email?.toLowerCase();
  if (!email || !payload?.email_verified) throw new HttpError(401, "Email no verificado");
  return email;
}

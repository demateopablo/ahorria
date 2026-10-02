import type { Session } from "./auth/session.js";
import type { PrismaClient } from "./db.js";

export interface AppEnv {
  Variables: {
    sesion: Session;
    p: PrismaClient;
  };
}

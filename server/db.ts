import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";
import { requireEnv } from "./env.js";

export type { PrismaClient };

let cliente: PrismaClient | undefined;

/**
 * Cliente único por proceso (en Vercel, por instancia de la Function).
 * Con Neon usar la connection string *pooled*.
 */
export function db(): PrismaClient {
  cliente ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: requireEnv("DATABASE_URL"), max: 5 }) });
  return cliente;
}

export async function cerrarDb(): Promise<void> {
  await cliente?.$disconnect();
  cliente = undefined;
}

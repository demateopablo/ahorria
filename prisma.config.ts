import { defineConfig } from "prisma/config";

// Prisma 7 no carga `.env` solo: `process.loadEnvFile` lo hace si existe (en Vercel las env ya vienen seteadas).
try {
  process.loadEnvFile();
} catch {
  // sin .env
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Migraciones: en Neon conviene la conexión directa (DIRECT_URL); la app usa la pooled (DATABASE_URL).
  datasource: { url: process.env.DIRECT_URL || process.env.DATABASE_URL || "" },
});

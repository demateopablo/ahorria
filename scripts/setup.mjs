#!/usr/bin/env node
/**
 * Instalación local en un paso:  npm run setup
 *
 *  1. Verifica Node y Docker.
 *  2. Crea .env desde .env.example (con SESSION_SECRET aleatorio y login de desarrollo activado).
 *  3. Levanta Postgres en docker, aplica las migraciones y genera el cliente de Prisma.
 *  4. Carga datos: los tuyos (seed/household.local.json) o, si no existe, la familia de ejemplo.
 *
 * Es idempotente: si algo ya está hecho, lo saltea. No toca nada en internet ni en producción.
 */
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const verde = (s) => `\x1b[32m${s}\x1b[0m`;
const amarillo = (s) => `\x1b[33m${s}\x1b[0m`;
const rojo = (s) => `\x1b[31m${s}\x1b[0m`;
const paso = (s) => console.log(`\n${verde("›")} ${s}`);
const correr = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });
const salida = (cmd) => {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return null;
  }
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(verde("\nAhorria · instalación local\n"));

// 1. Requisitos
const [mayor] = process.versions.node.split(".").map(Number);
if (mayor < 22) {
  console.error(rojo(`Necesitás Node 22 o más nuevo (tenés ${process.versions.node}). https://nodejs.org`));
  process.exit(1);
}
if (!salida("docker info --format {{.ServerVersion}}")) {
  console.error(rojo("Docker no está corriendo. Instalá Docker Desktop (https://docker.com) y abrilo, o usá tu propio Postgres:"));
  console.error("  poné su URL en DATABASE_URL dentro de .env y corré: npx prisma migrate deploy && npm run seed");
  process.exit(1);
}

// 2. .env
paso("Configuración (.env)");
if (existsSync(".env")) {
  console.log("  .env ya existe: no lo toco.");
} else {
  copyFileSync(".env.example", ".env");
  const env = readFileSync(".env", "utf8")
    .replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${randomBytes(32).toString("base64url")}`)
    .replace(/^ALLOW_DEV_LOGIN=.*$/m, "ALLOW_DEV_LOGIN=true");
  writeFileSync(".env", env);
  console.log("  .env creado con un SESSION_SECRET nuevo y el acceso de desarrollo activado.");
}

// 3. Base de datos
paso("Base de datos (Postgres en docker)");
correr("docker compose up -d db");
process.stdout.write("  Esperando a Postgres");
for (let i = 0; i < 30; i++) {
  if (salida("docker compose exec -T db pg_isready -U ahorria")?.includes("accepting")) break;
  process.stdout.write(".");
  await esperar(1000);
}
console.log();
correr("npx prisma migrate deploy");
correr("npx prisma generate");

// 4. Datos
paso("Datos del hogar");
const tieneHogar = salida(`docker compose exec -T db psql -U ahorria -d ahorria -tAc "select count(*) from \\"Config\\""`) === "1";
if (tieneHogar) {
  console.log("  La base ya tiene un hogar cargado: no lo toco (para empezar de cero: npm run seed -- --reset).");
} else if (existsSync("seed/household.local.json")) {
  correr("npm run seed");
} else {
  console.log("  No hay seed/household.local.json todavía: cargo la familia de ejemplo para que veas la app.");
  correr("npm run seed -- --file seed/household.example.json");
}

console.log(`
${verde("¡Listo!")} Arrancá la app con:

  npm run dev        →  http://localhost:5173  (botón «Entrar como …»)

Próximos pasos:
  • Tus datos: copiá seed/household.example.json a seed/household.local.json, editalo y corré
    ${amarillo("npm run seed -- --reset")}  (o pedile a Claude Code: «cargá mis datos en Ahorria»).
  • Publicarla para usarla desde el celular: README → «Producción».
`);

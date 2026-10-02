/**
 * Carga los datos iniciales del hogar.
 *
 *   npm run seed                 → usa seed/household.local.json si existe, si no el ejemplo
 *   npm run seed -- --reset      → BORRA todo y vuelve a cargar
 *   npm run seed -- --file x.json
 *   npm run seed -- --check      → solo valida el archivo
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hoy } from "../shared/domain/fechas.js";
import { cerrarDb, db } from "../server/db.js";
import { cargarHousehold, SeedError, vaciarBase, validarHousehold } from "../server/services/seed.js";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const valor = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

const local = resolve("seed/household.local.json");
const archivo = valor("--file") ?? (existsSync(local) ? local : resolve("seed/household.example.json"));

async function main() {
  console.log(`Archivo: ${archivo}`);
  let h;
  try {
    h = validarHousehold(JSON.parse(readFileSync(archivo, "utf8")));
  } catch (e) {
    if (e instanceof SeedError) {
      console.error(`\nEl archivo tiene errores:\n${e.message}`);
      process.exit(1);
    }
    throw e;
  }
  console.log(`OK: ${h.personas.length} personas, ${h.cuentas.length} cuentas, ${h.recurrencias.length} recurrencias, ${h.cuotas.length} planes de cuotas, ${h.eventos.length} eventos.`);
  if (flag("--check")) return;

  const p = db();
  const existente = await p.config.findUnique({ where: { id: 1 } });
  if (existente) {
    if (!flag("--reset")) {
      console.error(`\nLa base ya tiene un hogar ("${existente.nombreHogar}"). Para BORRAR todo y volver a cargar: npm run seed -- --reset`);
      process.exit(1);
    }
    console.log("Borrando datos existentes…");
    await vaciarBase(p);
  }

  const avisos = await cargarHousehold(p, h, hoy());
  for (const a of avisos) console.warn(`Aviso: ${a}`);
  console.log(`\nListo: hogar "${h.hogar.nombre}" cargado.`);
  const sinEmail = h.personas.filter((x) => !x.email).map((x) => x.nombre);
  if (sinEmail.length) console.log(`(${sinEmail.join(", ")} no tiene email: no va a poder iniciar sesión hasta que se lo agregues.)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => cerrarDb());

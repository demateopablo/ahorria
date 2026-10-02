---
name: setup
description: Levanta una instancia propia de Ahorria de punta a punta (local y/o producción en Vercel + Neon): instala, configura .env, crea la base, arma el archivo con los datos del hogar entrevistando a la persona, configura el login con Google y la IA opcional, y despliega. Usalo cuando alguien clona el repo y quiere "instalar", "configurar", "levantar", "deployar" o "cargar mis datos" en Ahorria.
---

# Setup de Ahorria

Guiás a una persona (que puede no ser desarrolladora) a tener **su propia instancia** de Ahorria: un
hogar por instancia. Hablale en español rioplatense, claro y sin jerga; un paso por vez, confirmando
antes de seguir. Leé `CLAUDE.md` para las reglas del proyecto.

## Reglas de seguridad (no negociables)

- **Los datos del hogar y los secretos nunca se commitean.** Van en `.env` y
  `seed/household.local.json` (ambos gitignoreados). Antes de cualquier commit, verificá con
  `git status --ignored` que sigan ignorados. Si la persona hizo fork público, recordáselo.
- No muestres secretos completos en la conversación (API keys, `DATABASE_URL`, `SESSION_SECRET`):
  escribilos directo en `.env` o pedile a la persona que los pegue ella con `! <comando>`.
- Las cuentas (Google Cloud, Neon, Vercel, proveedor de IA) las crea **la persona**, en su navegador.
  Vos le decís exactamente qué tocar; no completes formularios de login ni de pago por ella.
- `npm run seed -- --reset` **borra todo**: pedí confirmación explícita, y más aún contra producción.

## 0. Diagnóstico

1. Revisá: `node -v` (≥ 22), `git --version`, `docker --version` (opcional, solo para probar local).
2. Preguntá qué quiere: **(a)** probar en la compu, **(b)** dejarlo andando en internet para usarlo
   desde el celular, o **(c)** las dos (recomendado: primero local, después producción).
3. `npm install`.

## 1. Probar en la compu (opcional pero recomendado)

1. `cp .env.example .env`. Generá `SESSION_SECRET` con
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` y escribilo en `.env`.
   Poné `ALLOW_DEV_LOGIN=true` (permite entrar sin Google, solo en local).
2. `npm run db:up` (Postgres en docker), `npx prisma migrate deploy`, `npx prisma generate`.
3. Para ver la app con datos de ejemplo: `npm run seed -- --file seed/household.example.json`, después
   `npm run dev` y abrir http://localhost:5173 → "Entrar como Ana".
4. Cuando quiera sus datos: paso 2 y luego `npm run seed -- --reset` (confirmar antes).

## 2. Los datos del hogar (`seed/household.local.json`)

Armalo **entrevistando** a la persona, por bloques cortos. El formato está en `seed/schema.ts` y el
ejemplo completo en `seed/household.example.json` (copialo como base). Todo se referencia por nombre.

1. **Hogar**: nombre ("Casa de …") y margen mínimo mensual (por debajo, la proyección avisa en ámbar).
2. **Personas**: nombre y email de Google de quienes van a entrar. Sin email = no entra a la app
   (sirve para asignarle gastos, ej. un hijo).
3. **Cuentas**: efectivo, billeteras (Mercado Pago, Ualá…), bancos, tarjetas e inversiones. Titular,
   moneda, saldo actual (opcional) y TNA si rinde. Tarjetas: día de cierre y de vencimiento si los sabe.
4. **Ingresos fijos**: sueldo (día de cobro), aguinaldo (`semestral`, `mesAncla` = un diciembre), bonos.
5. **Gastos fijos**: alquiler, servicios, seguros, cuotas de colegio, suscripciones… Para cada uno:
   monto, frecuencia, día, cuenta y de quién es (`null` = "lo paga quien pase"). Si tiene fin (plan de
   pagos) → `hasta`; si empieza más adelante → `desde`. En USD → `"moneda": "USD"`.
6. **Gastos variables** (súper, verdulería, nafta, delivery): `"variable": true`. No generan
   pendientes; la proyección descuenta lo que se va cargando. Explicáselo así.
7. **Cuotas en curso**: compras nuevas → `cantidad` + `fechaCompra`; planes viejos de los que solo
   sabe la última → `ultimaCuota` ("2027-03").
8. **Eventos anuales**: cumpleaños, Día de la Madre, fiestas, vacaciones, con un monto estimado.
9. **Categorías**: ofrecé las del ejemplo y ajustá (nombres únicos; íconos válidos en `shared/iconos.ts`).

Validá con `npm run seed -- --check` y corregí hasta que dé OK. Mostrale un resumen (cuántas cuentas,
fijos, cuotas) y pedile que lo revise antes de cargarlo.

## 3. Login con Google (necesario para producción)

Guiala en https://console.cloud.google.com:

1. Crear un proyecto ("Ahorria").
2. **APIs y servicios → Pantalla de consentimiento de OAuth**: tipo *Externo*, nombre "Ahorria", su
   email de soporte. Scopes: los básicos (no agregar nada). En **Usuarios de prueba** agregar los emails
   de las personas del hogar (o publicar la app: con scopes básicos no requiere verificación).
3. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**.
   - *Orígenes de JavaScript autorizados*: `http://localhost:5173` y la URL de producción
     (`https://<proyecto>.vercel.app` o su dominio). **No** hace falta URI de redireccionamiento.
4. Copiar el *ID de cliente* (termina en `.apps.googleusercontent.com`; no es secreto) en `.env` como
   `GOOGLE_CLIENT_ID` **y** `VITE_GOOGLE_CLIENT_ID`. Reiniciar `npm run dev` y probar el botón.

## 4. IA (opcional)

Sirve para cargar escribiendo ("super 45 mil con MP"). Cualquier proveedor compatible con OpenAI:

- OpenRouter (recomendado, muchos modelos): crear key en https://openrouter.ai/keys,
  `LLM_BASE_URL=https://openrouter.ai/api/v1`, `LLM_MODEL=openai/gpt-4o-mini` (o el que prefiera; se
  pueden poner varios separados por coma como fallback).
- OpenAI: `LLM_BASE_URL=https://api.openai.com/v1`, `LLM_MODEL=gpt-4o-mini`.
- Ollama local: `LLM_BASE_URL=http://localhost:11434/v1`, cualquier `LLM_API_KEY` no vacía.

Sin `LLM_API_KEY` la app funciona igual; el campo de texto libre no aparece.

## 5. Producción (Vercel + Neon)

1. **Neon** (https://neon.tech, plan gratis): crear proyecto en la región más cercana (Argentina →
   *AWS São Paulo*). Copiar la connection string **pooled** (→ `DATABASE_URL`) y la **directa**
   (→ `DIRECT_URL`, sin `-pooler` en el host).
2. Migrar y cargar los datos en Neon desde la compu (la persona pega las URLs en la terminal, no en el chat):
   `! DATABASE_URL="<pooled>" DIRECT_URL="<directa>" npx prisma migrate deploy`
   `! DATABASE_URL="<pooled>" npm run seed`
3. **Vercel**: `npx vercel login`, `npx vercel link` (crear proyecto). Si Neon está en São Paulo,
   agregá `"regions": ["gru1"]` en `vercel.json` para que la Function quede cerca de la base.
4. Variables en Vercel (Production), una por una con `! npx vercel env add NOMBRE production`:
   `DATABASE_URL` (pooled), `SESSION_SECRET` (uno nuevo, distinto del local), `GOOGLE_CLIENT_ID`,
   `VITE_GOOGLE_CLIENT_ID` y, si usa IA, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`.
   **No** setear `ALLOW_DEV_LOGIN` en producción.
5. `npx vercel --prod`. Agregar la URL final a los *orígenes autorizados* de Google (paso 3).
6. Verificar: abrir la URL en el celular, entrar con Google, cargar un gasto. Instalar como app:
   Android/Chrome → menú ⋮ → *Instalar app*; iPhone/Safari → *Compartir* → *Agregar a inicio*.

## 6. Después

- Agregar a alguien: *Más → Personas* con su email de Google.
- Actualizar a una versión nueva del repo: `git pull`, `npx prisma migrate deploy` contra Neon (con
  `DIRECT_URL`) y `npx vercel --prod`.
- Backups: Neon guarda historial (restore point-in-time); para una copia propia, `pg_dump` con la URL directa.

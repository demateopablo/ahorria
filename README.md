<p align="center">
  <img src="public/favicon.svg" width="72" alt="" />
</p>

<h1 align="center">Ahorria</h1>

<p align="center">
  <strong>Tu plata, ordenada con IA.</strong><br />
  Lo que entra, lo que sale y, sobre todo, lo que viene.
</p>

<p align="center">
  <a href="#instalación-en-un-paso">Instalación</a> ·
  <a href="#cómo-funciona">Cómo funciona</a> ·
  <a href="#producción-usarla-desde-el-celular">Producción</a> ·
  <a href="#carga-con-ia-opcional">IA</a> ·
  <a href="#preguntas-frecuentes">Preguntas</a> ·
  <a href="#desarrollo">Desarrollo</a>
</p>

---

Ahorria es una app para llevar las finanzas de una pareja o familia. Se usa desde el celular
(se instala como una app), cargás un gasto en tres toques y te muestra **cuánto te va a sobrar en
los próximos meses**: con las cuotas, los gastos fijos, el aguinaldo y los cumpleaños ya contemplados.

Es **código abierto y self-hosted**: cada hogar levanta su propia instancia, con su propia base de
datos, en servicios gratuitos. No hay un servidor central ni nadie más que vea tus números.

Pensada para Argentina: pesos y dólares (con cotización automática), tarjetas que se pagan a mes
vencido, cuotas, aguinaldo, bonos trimestrales, ajustes por inflación.

<p align="center">
  <img src="docs/capturas/inicio.webp" width="200" alt="Inicio: pendientes para confirmar y lo que queda en el mes" />
  <img src="docs/capturas/carga.webp" width="200" alt="Carga rápida con teclado numérico y categorías" />
  <img src="docs/capturas/proyeccion.webp" width="200" alt="Proyección de flujo a 6 meses" />
  <img src="docs/capturas/cuotas.webp" width="200" alt="Compras en cuotas" />
</p>
<p align="center"><sub>Capturas con datos de ejemplo.</sub></p>

## Qué hace

| | |
|---|---|
| **Carga en 3 toques** | Monto, categoría, guardar. Cuenta, fecha, persona y ámbito se completan solos (y se cambian si hace falta). Con IA: «super 45 mil con MP». |
| **Fijos para confirmar** | Sueldo, alquiler, servicios: cada mes aparecen *pendientes* y se confirman con un toque, editando el monto si cambió. |
| **Gastos variables** | Súper, nafta, verdulería: se cargan compra por compra y la proyección estima solo lo que falta gastar. |
| **Cuotas** | Una compra en 12 cuotas son 12 gastos futuros. Ves cuánto de tus próximos sueldos ya está comprometido. |
| **Tarjetas a mes vencido** | Lo que consumís en octubre impacta en el flujo de noviembre (respeta el día de cierre). |
| **Persona y hogar** | Cada uno ve lo suyo, el hogar ve todo. Las transferencias entre ustedes no son gasto: nada se cuenta dos veces. |
| **Proyección** | 6 o 12 meses: ingresos esperados, fijos, cuotas y eventos. La sobra de cada mes y aviso cuando viene *ajustado* o *en rojo*. |
| **Dólares** | Cotización oficial (BNA) y MEP automática todos los días. Cada gasto en USD guarda la suya. |
| **App en el celular** | Se instala desde el navegador (PWA), con atajo directo a «Cargar gasto». |

## Instalación en un paso

Necesitás [Node 22+](https://nodejs.org) y [Docker Desktop](https://www.docker.com/products/docker-desktop/) abierto.

```bash
npx degit demateopablo/ahorria mi-ahorria && cd mi-ahorria && npm install && npm run setup
```

`npm run setup` crea el `.env` (con un secreto nuevo), levanta Postgres en Docker, arma las tablas y
carga una **familia de ejemplo** para que veas la app andando. Después:

```bash
npm run dev     # → http://localhost:5173  (botón «Entrar como Ana»)
```

> **¿Usás [Claude Code](https://claude.com/claude-code)?** Abrí la carpeta y escribí
> **«quiero instalar Ahorria»**. El skill [`setup`](.claude/skills/setup/SKILL.md) hace todo lo de
> esta página por vos: te entrevista para cargar tus datos, te guía con Google y lo publica en Vercel.

## Tus datos

Todo lo de tu hogar va en **`seed/household.local.json`**, que nunca se sube al repo (está en el
`.gitignore`). Partí del ejemplo:

```bash
cp seed/household.example.json seed/household.local.json
# editalo: personas, cuentas, sueldos, fijos, cuotas, eventos…
npm run seed -- --check     # valida el archivo y te dice qué está mal
npm run seed -- --reset     # borra la base local y carga tus datos
```

Todo se referencia por nombre y el formato está comentado en [`seed/schema.ts`](seed/schema.ts). Un
resumen:

```jsonc
{
  "hogar": { "nombre": "Casa de Ana y Leo", "umbralMargenBajo": 250000 },
  "personas": [{ "nombre": "Ana", "email": "ana@gmail.com" }],          // el email de Google es el acceso
  "cuentas": [{ "nombre": "Mercado Pago", "tipo": "billetera", "titular": "Ana", "saldoInicial": 600000 }],
  "recurrencias": [
    { "concepto": "Sueldo", "tipo": "ingreso", "monto": 1800000, "dia": 3, "dueno": "Ana", "cuenta": "Mercado Pago", "categoria": "Sueldo" },
    { "concepto": "Aguinaldo", "tipo": "ingreso", "monto": 900000, "frecuencia": "semestral", "mesAncla": "2026-12", "dia": 18, "dueno": "Ana", "cuenta": "Mercado Pago" },
    { "concepto": "Alquiler", "monto": 550000, "dia": 5, "dueno": "Ana", "cuenta": "Mercado Pago", "categoria": "Vivienda" },
    { "concepto": "Súper", "monto": 320000, "variable": true, "dueno": null, "cuenta": "Mercado Pago", "categoria": "Súper" }
  ],
  "cuotas": [
    { "descripcion": "Heladera", "montoCuota": 48500, "cantidad": 12, "fechaCompra": "2026-09-14", "cuenta": "Tarjeta Ana" },
    { "descripcion": "Préstamo", "montoCuota": 62000, "ultimaCuota": "2027-02", "cuenta": "Mercado Pago" }
  ],
  "eventos": [{ "nombre": "Fiestas", "mes": 12, "monto": 250000 }]
}
```

Todo esto también se puede editar después desde la app (*Más*).

## Cómo funciona

**Movimientos.** Cada uno es un *ingreso*, un *gasto* o una *transferencia*, tiene un **dueño** (una
persona del hogar), un **ámbito** (personal, compartido, negocio, familia) y una **cuenta**. Además
de la fecha en que gastaste, guarda la **fecha de impacto**: con tarjeta, el gasto pega en el
resumen del mes siguiente (o del otro, si compraste después del cierre).

**Vistas.** Arriba de cada pantalla elegís *Hogar* o una persona. En *Hogar* las transferencias
entre ustedes no existen: si Ana le pasa plata a Leo para pagar la tarjeta, el gasto real es lo que
Leo consumió con esa tarjeta. En la vista de cada uno, la transferencia aparece aparte (enviada o
recibida), nunca como gasto.

**Fijos y variables.** Un fijo (alquiler, sueldo, seguro) genera cada período un movimiento
*pendiente* que confirmás con un toque. Un variable (súper, nafta) no genera nada: cargás cada compra
y la proyección descuenta lo ya gastado en esa categoría del monto estimado del mes.

**Cuotas.** Al cargar una compra en N cuotas se crean N gastos, uno por mes. Si la cancelás antes,
se borran solo las cuotas que todavía no se pagaron.

**Proyección.** Para cada mes suma lo ya cargado (confirmado, pendiente, cuotas) más lo esperado de
los fijos y los eventos del año (cumpleaños, fiestas). Muestra la **sobra** y el **acumulado**:
*Bien* si supera el margen mínimo que definiste, *Ajustado* si queda por debajo, *En rojo* si es
negativa.

**Dólar.** Una vez por día la app trae el oficial del Banco Nación y el MEP
([dolarapi.com](https://dolarapi.com); si no responde, la API del BCRA). Los gastos en USD guardan la
cotización del momento; en *Más → Dólar* podés cargar otra a mano.

## Producción: usarla desde el celular

Tres cuentas gratuitas, ~20 minutos:

1. **Base de datos: [Neon](https://neon.tech).** Creá un proyecto (si estás en Argentina, región
   *AWS São Paulo*). Copiá la connection string **pooled** y la **directa** (la misma sin `-pooler`);
   en ambas cambiá `sslmode=require` por `sslmode=verify-full`. Guardalas en `.env.production.local`
   (no se sube al repo):
   ```bash
   DATABASE_URL="postgresql://…-pooler…/neondb?sslmode=verify-full"
   DIRECT_URL="postgresql://…/neondb?sslmode=verify-full"
   ```
   Y cargá la base desde tu compu:
   ```bash
   set -a && . ./.env.production.local && set +a
   npx prisma migrate deploy && npm run seed
   ```
2. **Login: [Google Cloud](https://console.cloud.google.com).** Creá un proyecto → *Google Auth
   Platform* → público *Externo* → agregá los emails del hogar como *usuarios de prueba* → *Clientes* →
   *Aplicación web*. En **orígenes de JavaScript autorizados** poné tu URL de producción y
   `http://localhost:5173` (no hace falta URI de redirección). Copiá el **ID de cliente**.
3. **Hosting: [Vercel](https://vercel.com).**
   ```bash
   npx vercel login
   npx vercel link
   npx vercel env add DATABASE_URL production      # la pooled
   npx vercel env add SESSION_SECRET production    # node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   npx vercel env add GOOGLE_CLIENT_ID production
   npx vercel env add VITE_GOOGLE_CLIENT_ID production   # el mismo ID de cliente
   npx vercel deploy --prod
   ```
   Si tu base está en São Paulo, dejá `"regions": ["gru1"]` en `vercel.json` (ya viene así).

O con un clic (después igual tenés que cargar la base del paso 1):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdemateopablo%2Fahorria&env=DATABASE_URL,SESSION_SECRET,GOOGLE_CLIENT_ID,VITE_GOOGLE_CLIENT_ID&envDescription=Connection%20string%20pooled%20de%20Neon%2C%20un%20secreto%20aleatorio%20y%20el%20Client%20ID%20de%20Google&envLink=https%3A%2F%2Fgithub.com%2Fdemateopablo%2Fahorria%23producci%C3%B3n-usarla-desde-el-celular)

**Instalarla en el celular:** abrí la URL → en Android/Chrome, menú ⋮ → *Instalar app*; en
iPhone/Safari, *Compartir* → *Agregar a inicio*.

**Dominio propio** (opcional): `npx vercel domains add finanzas.tudominio.com` y creá el CNAME que te
indica (si usás Cloudflare, con el proxy desactivado). Acordate de sumarlo a los orígenes de Google.

## Carga con IA (opcional)

Permite cargar escribiendo: «ayer nafta 30 mil con la tarjeta», «le pasé 100 lucas a Leo». La IA
solo **completa el formulario**: nunca guarda nada sin que lo confirmes. Funciona con cualquier
proveedor compatible con la API de OpenAI; la key va como variable de entorno (no se carga desde la
app, para no guardar un secreto en la base).

| Proveedor | `LLM_BASE_URL` | `LLM_MODEL` | Costo |
|---|---|---|---|
| [OpenRouter](https://openrouter.ai/keys) | `https://openrouter.ai/api/v1` | `openrouter/free` | **Gratis** (con límite diario) |
| [OpenRouter](https://openrouter.ai/keys) | `https://openrouter.ai/api/v1` | `google/gemini-2.5-flash` | < USD 0,001 por carga |
| [Anthropic (Claude)](https://console.anthropic.com/settings/keys) | `https://api.anthropic.com/v1` | `claude-haiku-4-5` | Pago por uso |
| [OpenAI](https://platform.openai.com/api-keys) | `https://api.openai.com/v1` | `gpt-4o-mini` | Pago por uso |
| [Ollama](https://ollama.com) (local) | `http://localhost:11434/v1` | el modelo que tengas | Gratis |

```bash
npx vercel env add LLM_BASE_URL production
npx vercel env add LLM_MODEL production       # uno o varios separados por coma (se prueban en orden)
npx vercel env add LLM_API_KEY production
npx vercel deploy --prod
```

Con modelos gratis la respuesta puede tardar unos segundos o fallar si están saturados: la app
reintenta con otro modelo y, si no puede, te avisa y seguís cargando a mano.

## Actualizar a una versión nueva

```bash
git pull                                        # o volvé a bajar con degit
npm install
set -a && . ./.env.production.local && set +a
npx prisma migrate deploy                       # aplica los cambios de la base en Neon
npx vercel deploy --prod
```

## Preguntas frecuentes

**¿Mis datos están seguros?** Viven en tu base de Neon, con conexión cifrada. Solo entran las
personas cuyo email de Google cargaste en *Más → Personas*; la sesión es una cookie `HttpOnly`. La
app instalada no guarda tus datos financieros en el celular.

**¿Cuánto cuesta?** Nada para un hogar: Neon, Vercel (plan Hobby) y Google tienen planes gratuitos
de sobra para esto. La IA es opcional y puede ser gratis (OpenRouter).

**¿Puedo sumar a alguien más?** Sí: *Más → Personas* con su email de Google (y agregalo como usuario
de prueba en Google Cloud). Una persona sin email también sirve para asignarle gastos, por ejemplo
un hijo.

**¿Funciona fuera de Argentina?** La lógica es general (tarjetas, cuotas, proyección); la moneda base
es ARS con dólares como segunda moneda y la cotización automática es argentina. Está pensada para
adaptarse: los formatos y la zona horaria salen de la configuración del hogar.

**¿Y si dejo de usarla?** Tus datos son tuyos: `pg_dump` con la URL directa de Neon y te llevás todo.

## Desarrollo

**Stack:** React 19 + Vite + Tailwind 4 (PWA) · API con [Hono](https://hono.dev) en una sola Vercel
Function · Postgres con Prisma 7 · Vitest. Montos siempre en `Decimal`, nunca `float`.

```
shared/domain/   lógica pura y testeada: fechas, dinero, impacto de tarjetas, recurrencias, cuotas, vistas, proyección
shared/schemas/  contrato de la API (zod + tipos)
server/          API Hono: auth, rutas finas, servicios (Prisma + dominio)
api/index.ts     la única Vercel Function
src/             la app (React): carga, inicio, movimientos, proyección, ajustes
seed/            formato y ejemplo del archivo del hogar
```

```bash
npm run dev          # web (5173) + API (8787)
npm test             # dominio + API contra Postgres real (npm run db:up crea la base de test)
npm run lint         # oxlint
npx tsc -b           # typecheck
npm run build        # build de producción (PWA incluida)
npm run db:migrate   # nueva migración (después: npx prisma generate)
```

Las reglas del dominio y los detalles que muerden están en [`CLAUDE.md`](CLAUDE.md). Los PRs son
bienvenidos: si cambiás una regla de cálculo, sumá su test en `shared/domain/`.

### Variables de entorno

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Postgres. En Neon, la connection string *pooled*. |
| `DIRECT_URL` | Opcional: conexión directa para migraciones en Neon. |
| `SESSION_SECRET` | Secreto aleatorio para firmar la sesión. |
| `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` | El mismo ID de cliente de Google, para el server y la app. |
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | Opcional: IA (ver [Carga con IA](#carga-con-ia-opcional)). |
| `ALLOW_DEV_LOGIN` | Solo local: entrar sin Google. Nunca funciona en Vercel. |
| `COTIZACION_AUTOMATICA` | `false` para no traer la cotización del dólar sola. |

## Licencia

[MIT](LICENSE) © Pablo Demateo. Fotos de Unsplash y demás créditos en [CREDITS.md](CREDITS.md).

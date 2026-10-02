# CLAUDE.md

Guía para Claude Code (y para cualquier persona) que trabaje en este repo.

## Qué es

**Ahorria** (ahorro + IA): app de finanzas familiares, mobile-first e instalable como PWA. Es
**self-hosted**: cada hogar levanta su propia instancia (un hogar por base de datos, sin multi-tenant).
Pensada para Argentina (es-AR, pesos y dólares, tarjetas que se pagan a mes vencido).

Para levantar una instancia nueva, usá el skill `setup` (`.claude/skills/setup/SKILL.md`).

## Reglas que no se rompen

1. **Nunca `float` para plata.** Montos en `Decimal(14,2)` en la base, `decimal.js` en el dominio y
   strings ("1234.56") en la API. En el front, cualquier suma pasa por `dec()`/`sumar()` de
   `shared/domain/dinero.ts`.
2. **Una transferencia nunca es gasto ni ingreso** (`shared/domain/vistas.ts`). Si una persona le pasa
   plata a otra para pagar algo, el gasto es el consumo; la transferencia en la vista Hogar no existe y
   en la vista de cada persona aparece aparte (enviada/recibida).
3. **Todo se ubica por fecha de impacto.** Las tarjetas impactan a mes vencido (`impacto.ts`: con día
   de cierre, lo consumido después del cierre se paga dos meses después).
4. **Las cuotas se materializan**: un plan de N cuotas crea N movimientos (`services/cuotas.ts`).
   Cancelar el plan borra solo las futuras.
5. **Recurrencias fijas → pendientes; variables → no.** Las fijas (alquiler, sueldo) generan un
   movimiento `pendiente` por período (idempotente: único por `recurrenciaId + periodo`). Las
   variables (súper, nafta) se cargan compra por compra y en la proyección solo estiman lo que falta
   gastar en su categoría. La proyección nunca cuenta dos veces un período ya materializado.
6. **Datos reales fuera del repo (es público).** Los datos del hogar van en
   `seed/household.local.json` y cualquier `*.local.*` (gitignoreados). Nada de nombres, montos ni
   emails reales en código, tests o docs. Antes de un push: `git ls-files | grep -i local` tiene que
   estar vacío.
7. **es-AR en todo**: textos en español rioplatense (voseo), `formatMonto` → "$ 1.234.567,89", zona
   `America/Argentina/Buenos_Aires` (`hoy()` de `fechas.ts`, nunca `new Date()` para "hoy").

## Comandos

```bash
npm run db:up        # Postgres local en docker (crea también la base ahorria_test)
npm run db:migrate   # prisma migrate dev  → después correr `npx prisma generate` (Prisma 7 no genera solo)
npm run seed         # carga seed/household.local.json (o el ejemplo). --reset borra todo; --check solo valida
npm run dev          # Vite (5173) + API Hono (8787) con proxy /api
npm test             # vitest: dominio + API contra TEST_DATABASE_URL (se saltean sin base)
npm run lint         # oxlint
npx tsc -b           # typecheck (app + node)
npm run build        # prisma generate + tsc + vite build (PWA incluida)
npm run assets       # baja/optimiza las fotos de Unsplash y genera los íconos (ver CREDITS.md)
```

Login local sin Google: `ALLOW_DEV_LOGIN=true` en `.env` muestra "Entrar como …" (solo personas con
email; nunca funciona en Vercel ni con `NODE_ENV=production`).

## Arquitectura

- **`shared/domain/`**: lógica pura y testeada (fechas, dinero, impacto, recurrencias, cuotas, vistas,
  resumen del mes, proyección). Sin dependencias de base ni de React. Es lo primero que se toca y se
  testea ante cualquier cambio de reglas.
- **`shared/schemas/api.ts`**: contrato de la API: schemas zod de entrada (validan en el server) y
  tipos de salida (DTOs). El front solo importa tipos de acá (zod no entra al bundle).
- **`server/`**: API Hono. `app.ts` arma todo bajo `/api` con un middleware de sesión (cookie JWT
  HttpOnly, `Path=/api`) y chequeo de `Origin` en escrituras. `routes/` son finas: validan y delegan
  en `services/` (que orquestan Prisma + dominio). `dto.ts` convierte Prisma → DTO.
- **`api/index.ts`**: la única Vercel Function; `vercel.json` reescribe `/api/*` hacia ella.
- **Auth**: Google Identity Services → `POST /api/auth/login` verifica el ID token y exige que el email
  sea el de una `Persona`. **La tabla Persona es la lista de acceso.**
- **`src/`** (React 19 + Vite + Tailwind 4): `app/` (layout, contexto del hogar y la vista global),
  `features/` (carga, inicio, movimientos, proyección, ajustes, login), `components/` (UI chica),
  `lib/` (cliente API y hooks de TanStack Query; toda escritura invalida las queries).

## Detalles que muerden

- CSS base en `@layer base` (`src/index.css`): si se saca de la capa, pisa las utilidades de Tailwind 4.
- `cx()` usa `tailwind-merge`: un `className` que llega por props puede pisar clases del componente.
- Tokens de color en `:root` con variante oscura (media query + `data-theme`). Rojo solo para lo
  crítico; los estados (ok/ámbar/rojo) siempre con ícono + texto.
- Mobile first: todo lo tocable ≥ 44 px, inputs a 16 px (iOS hace zoom con menos), las hojas se cierran
  con el botón atrás (`Sheet.tsx`).
- El service worker no cachea `/api/*` (datos financieros): `NetworkOnly`.
- Imports en `server/`, `shared/`, `api/` y `scripts/` con extensión `.js` (Node ESM en Vercel).

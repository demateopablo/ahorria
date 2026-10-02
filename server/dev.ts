/** Servidor de la API para desarrollo local (Vite hace proxy de /api a este puerto). */
import { serve } from "@hono/node-server";
import { crearApp } from "./app.js";

const port = Number(process.env.API_PORT ?? 8787);
serve({ fetch: crearApp().fetch, port }, () => {
  console.log(`API de Ahorria en http://localhost:${port}/api`);
});

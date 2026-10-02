/**
 * Única Vercel Function: toda la API (Hono). `vercel.json` reescribe /api/* hacia acá.
 */
import { handle } from "hono/vercel";
import { crearApp } from "../server/app.js";

const handler = handle(crearApp());

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;

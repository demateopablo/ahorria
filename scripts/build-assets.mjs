/**
 * Genera los assets derivados (se commitean; correr solo si cambian):
 *   - Fotos de Unsplash (licencia Unsplash: uso comercial gratis) → public/img/*.webp
 *   - Íconos de la PWA desde el SVG del logo → public/icons/*.png
 *
 *   npm run assets
 *
 * Las fotos se bajan por el endpoint de descarga oficial (cuenta la descarga para el autor).
 * Créditos en CREDITS.md.
 */
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const FOTOS = [
  { id: "joqWSI9u_XM", archivo: "login", ancho: 1080, alto: 900 }, // frasco con monedas y una planta
  { id: "E2pcaL3s_js", archivo: "vacio", ancho: 720, alto: 400 }, // hoja verde y tarjetas en blanco
  { id: "5OUMf1Mr5pU", archivo: "cuotas", ancho: 720, alto: 400 }, // chanchito con monedas
];

// Moneda dorada con el ₳. Con `fondo` (maskable / iOS) el ícono va a sangre en el color de la moneda.
const MONEDA = `<circle cx="32" cy="32" r="25.5" fill="none" stroke="#8a5a00" stroke-opacity=".4" stroke-width="1.6"/>
<path d="M21.5 45 L32 17 L42.5 45" fill="none" stroke="#1a1a1a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M19.5 32.5 H44.5 M17.5 39 H46.5" stroke="#1a1a1a" stroke-width="3.2" stroke-linecap="round"/>`;
const LOGO = (fondo = false, pad = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${64 + 2 * pad} ${64 + 2 * pad}">
${fondo ? `<rect x="${-pad}" y="${-pad}" width="${64 + 2 * pad}" height="${64 + 2 * pad}" fill="#f5b82e"/>` : `<circle cx="32" cy="32" r="30" fill="#f5b82e"/>`}
${MONEDA}</svg>`;

async function fotos() {
  await mkdir("public/img", { recursive: true });
  for (const f of FOTOS) {
    const res = await fetch(`https://unsplash.com/photos/${f.id}/download?force=true`, { redirect: "manual", headers: { "user-agent": "Mozilla/5.0 (ahorria build-assets)" } });
    const url = res.headers.get("location");
    if (!url?.startsWith("https://images.unsplash.com/")) throw new Error(`${f.id}: no tiene descarga libre (¿Unsplash+?)`);
    const img = await fetch(`${url.split("?")[0]}?w=${f.ancho * 2}&q=85&fm=jpg`);
    const buf = Buffer.from(await img.arrayBuffer());
    await sharp(buf).resize(f.ancho, f.alto, { fit: "cover", position: "attention" }).webp({ quality: 72 }).toFile(`public/img/${f.archivo}.webp`);
    console.log(`img/${f.archivo}.webp ← ${f.id}`);
  }
}

async function iconos() {
  await mkdir("public/icons", { recursive: true });
  const png = (svg, size, out) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/icons/${out}`);
  // "any": el logo con sus esquinas redondeadas sobre transparente
  await png(LOGO(false), 192, "icon-192.png");
  await png(LOGO(false), 512, "icon-512.png");
  // maskable: zona segura del 80 %, fondo lleno
  await png(LOGO(true, 10), 512, "icon-maskable-512.png");
  // iOS no admite transparencia: fondo lleno
  await png(LOGO(true, 4), 180, "apple-touch-icon.png");
  console.log("icons/*.png");
}

// `npm run assets -- --solo-iconos` no vuelve a bajar las fotos.
if (!process.argv.includes("--solo-iconos")) await fotos();
await iconos();

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
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const FOTOS = [
  { id: "joqWSI9u_XM", archivo: "login", ancho: 1080, alto: 900 }, // frasco con monedas y una planta
  { id: "E2pcaL3s_js", archivo: "vacio", ancho: 720, alto: 400 }, // hoja verde y tarjetas en blanco
  { id: "5OUMf1Mr5pU", archivo: "cuotas", ancho: 720, alto: 400 }, // chanchito con monedas
];

const LOGO = (fondo = true, pad = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${64 + 2 * pad} ${64 + 2 * pad}">
${fondo ? `<rect x="${-pad}" y="${-pad}" width="${64 + 2 * pad}" height="${64 + 2 * pad}" fill="#15803d"/>` : ""}
<rect width="64" height="64" rx="16" fill="#15803d"/>
<path d="M17 48 L32 15 L47 48" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="32" cy="38" r="5.5" fill="#bbf7d0"/></svg>`;

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
  await writeFile("public/icons/.keep", "");
  console.log("icons/*.png");
}

await fotos();
await iconos();

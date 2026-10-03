/** Tema por dispositivo: "sistema" sigue al celular/compu; claro u oscuro lo fija. El script de index.html lo aplica al cargar. */
export type Tema = "sistema" | "light" | "dark";

const CLAVE = "ahorria-tema";
const COLOR = { light: "#f6f7f5", dark: "#0e100f" };

export function leerTema(): Tema {
  try {
    const t = localStorage.getItem(CLAVE);
    return t === "light" || t === "dark" ? t : "sistema";
  } catch {
    return "sistema";
  }
}

export function aplicarTema(tema: Tema) {
  try {
    if (tema === "sistema") localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, tema);
  } catch {
    // sin almacenamiento (modo privado): vale solo para esta sesión
  }
  const raiz = document.documentElement;
  if (tema === "sistema") delete raiz.dataset.theme;
  else raiz.dataset.theme = tema;
  for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const esquema = m.media.includes("dark") ? "dark" : "light";
    m.content = COLOR[tema === "sistema" ? esquema : tema];
  }
}

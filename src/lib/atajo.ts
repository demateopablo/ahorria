/**
 * Atajo del ícono de la app instalada: `/?cargar=1` abre la carga rápida.
 * Se lee y se limpia de la URL ANTES del primer render, así no interfiere con el historial
 * que usan las hojas para el botón "atrás".
 */
let abrirCarga = false;

export function capturarAtajo() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("cargar") !== "1") return;
  url.searchParams.delete("cargar");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  abrirCarga = true;
}

export const hayAtajoCarga = () => abrirCarga;
export const olvidarAtajo = () => {
  abrirCarga = false;
};

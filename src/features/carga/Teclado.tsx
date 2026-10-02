import { Delete } from "lucide-react";

/** Teclado numérico propio: evita que el teclado del sistema tape la pantalla. */
export function Teclado({ onTecla }: { onTecla: (t: string) => void }) {
  const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"];
  return (
    <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Teclado numérico">
      {teclas.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onTecla(t)}
          aria-label={t === "⌫" ? "Borrar" : t === "," ? "Coma decimal" : t}
          className="num flex h-14 items-center justify-center rounded-2xl bg-surface text-2xl font-medium text-ink active:bg-surface-2"
        >
          {t === "⌫" ? <Delete size={24} strokeWidth={1.8} /> : t}
        </button>
      ))}
    </div>
  );
}

/** Aplica una tecla al texto del monto ("45000", "1234,5"). Máximo 2 decimales y 12 enteros. */
export function aplicarTecla(actual: string, t: string): string {
  if (t === "⌫") return actual.slice(0, -1);
  if (t === ",") {
    if (actual.includes(",")) return actual;
    return actual === "" ? "0," : `${actual},`;
  }
  const [ent, dec] = actual.split(",");
  if (dec !== undefined) return dec.length >= 2 ? actual : actual + t;
  if (ent === "0") return t;
  if (ent.length >= 12) return actual;
  return actual + t;
}

/** "1234567,5" → "1.234.567,5" para mostrar mientras se tipea. */
export function mostrarMontoTipeado(texto: string): string {
  if (!texto) return "0";
  const [ent, dec] = texto.split(",");
  const conPuntos = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dec !== undefined ? `${conPuntos},${dec}` : conPuntos;
}

/** "1234.5" (API) → "1234,5" (teclado). */
export function montoATexto(monto: string | undefined | null): string {
  if (!monto) return "";
  const [ent, dec] = monto.split(".");
  return dec && Number(dec) !== 0 ? `${ent},${dec.replace(/0+$/, "")}` : ent;
}

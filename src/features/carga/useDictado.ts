import { useEffect, useRef, useState } from "react";

/**
 * Dictado con el reconocimiento de voz del navegador (Web Speech API): Chrome/Android y Safari.
 * Sin soporte (Firefox) `disponible` es false y no se muestra el micrófono.
 */

// TypeScript no trae estos tipos en lib.dom: lo mínimo que usamos.
interface Reconocedor {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type ConReconocedor = { SpeechRecognition?: new () => Reconocedor; webkitSpeechRecognition?: new () => Reconocedor };

const Reconocedor = typeof window === "undefined" ? undefined : ((window as ConReconocedor).SpeechRecognition ?? (window as ConReconocedor).webkitSpeechRecognition);

const ERRORES: Record<string, string> = {
  "not-allowed": "No hay permiso para usar el micrófono. Habilitalo en el navegador o escribilo.",
  "service-not-allowed": "El navegador no deja dictar acá. Escribilo o usá el micrófono del teclado.",
  "no-speech": "No te escuché. Tocá el micrófono y probá de nuevo.",
  "audio-capture": "No encontré un micrófono.",
  network: "El dictado necesita conexión a internet.",
};

interface Opciones {
  /** Texto reconocido hasta ahora (va cambiando mientras se habla). */
  onParcial: (texto: string) => void;
  /** Al terminar de hablar, con el texto final (no se llama si no se reconoció nada). */
  onFinal: (texto: string) => void;
  onError: (mensaje: string) => void;
}

export function useDictado(opciones: Opciones) {
  const [escuchando, setEscuchando] = useState(false);
  const rec = useRef<Reconocedor | null>(null);
  // Los callbacks siempre frescos, aunque el reconocedor se haya creado en un render anterior.
  const cb = useRef(opciones);
  useEffect(() => {
    cb.current = opciones;
  });
  useEffect(() => () => rec.current?.abort(), []);

  function empezar() {
    if (!Reconocedor) return;
    const r = new Reconocedor();
    r.lang = "es-AR";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    let texto = "";
    let fallo = false;
    r.onresult = (e) => {
      texto = Array.from(e.results, (x) => x[0].transcript).join("");
      cb.current.onParcial(texto);
    };
    r.onerror = (e) => {
      fallo = true;
      if (e.error !== "aborted") cb.current.onError(ERRORES[e.error] ?? "No pude usar el dictado. Escribilo o usá el micrófono del teclado.");
    };
    r.onend = () => {
      rec.current = null;
      setEscuchando(false);
      if (!fallo && texto.trim()) cb.current.onFinal(texto.trim());
    };
    rec.current = r;
    setEscuchando(true);
    try {
      r.start();
    } catch {
      rec.current = null;
      setEscuchando(false);
      cb.current.onError("No pude usar el dictado. Escribilo o usá el micrófono del teclado.");
    }
  }

  return {
    disponible: Boolean(Reconocedor),
    escuchando,
    /** Empieza a escuchar o, si ya está escuchando, corta (y manda lo dicho hasta ahí). */
    alternar: () => (rec.current ? rec.current.stop() : empezar()),
  };
}

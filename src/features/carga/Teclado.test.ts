import { describe, expect, it } from "vitest";
import { aplicarTecla, montoATexto, mostrarMontoTipeado } from "./Teclado";

const tipear = (teclas: string) => [...teclas].reduce((acc, t) => aplicarTecla(acc, t === "<" ? "⌫" : t), "");

describe("teclado de montos", () => {
  it("arma montos enteros y decimales", () => {
    expect(tipear("45000")).toBe("45000");
    expect(tipear("1234,567")).toBe("1234,56");
    expect(tipear(",5")).toBe("0,5");
    expect(tipear("00012")).toBe("12");
    expect(tipear("12,,3")).toBe("12,3");
    expect(tipear("123<")).toBe("12");
  });

  it("muestra con separador de miles", () => {
    expect(mostrarMontoTipeado("1234567,5")).toBe("1.234.567,5");
    expect(mostrarMontoTipeado("")).toBe("0");
  });

  it("convierte el monto de la API al formato del teclado", () => {
    expect(montoATexto("45000")).toBe("45000");
    expect(montoATexto("1234.50")).toBe("1234,5");
    expect(montoATexto("100.00")).toBe("100");
  });
});

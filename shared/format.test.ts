import { describe, expect, it } from "vitest";
import { formatFecha, formatMes, formatMonto, parseMontoAR } from "./format.js";

describe("formato es-AR", () => {
  it("formatea montos en pesos", () => {
    expect(formatMonto("1234567.89")).toBe("$ 1.234.567,89");
    expect(formatMonto("650000", "ARS", { compacto: true })).toBe("$ 650.000");
    expect(formatMonto("48123.45", "ARS", { compacto: true })).toBe("$ 48.123,45");
    expect(formatMonto("-1500")).toBe("-$ 1.500,00");
  });

  it("formatea dólares", () => {
    expect(formatMonto("20", "USD")).toBe("US$ 20,00");
  });

  it("formatea meses y fechas", () => {
    expect(formatMes("2026-10")).toBe("octubre 2026");
    expect(formatMes("2027-01", true)).toBe("ene 27");
    expect(formatFecha("2026-10-05")).toBe("05/10/2026");
    expect(formatFecha("2026-10-05", true)).toBe("5 oct");
  });

  it("interpreta montos escritos a la argentina", () => {
    expect(parseMontoAR("45000")).toBe("45000");
    expect(parseMontoAR("45.000")).toBe("45000");
    expect(parseMontoAR("$ 1.234,56")).toBe("1234.56");
    expect(parseMontoAR("1234,5")).toBe("1234.5");
    expect(parseMontoAR("12.5")).toBe("12.5");
    expect(parseMontoAR("abc")).toBeNull();
    expect(parseMontoAR("1,234")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { cuotaDelMes, cuotasRestantes, impactosCuotas } from "./cuotas.js";
import { aMonedaBase, centavos, dec, porcentaje, sumar } from "./dinero.js";
import { difMeses, esFecha, esMes, fechaEnMes, hoy, rangoMeses, sumarMeses, sumarMesesFecha } from "./fechas.js";
import { fechaImpacto } from "./impacto.js";
import { montoMensual, ocurreEn, periodos, prorrateoTotal } from "./recurrencias.js";

describe("fechas", () => {
  it("suma meses cruzando el año", () => {
    expect(sumarMeses("2026-11", 2)).toBe("2027-01");
    expect(sumarMeses("2027-01", -2)).toBe("2026-11");
    expect(sumarMeses("2026-10", 12)).toBe("2027-10");
  });

  it("calcula diferencias de meses", () => {
    expect(difMeses("2026-10", "2027-04")).toBe(6);
    expect(difMeses("2027-04", "2026-10")).toBe(-6);
  });

  it("recorta el día al fin de mes", () => {
    expect(fechaEnMes("2027-02", 31)).toBe("2027-02-28");
    expect(fechaEnMes("2028-02", 31)).toBe("2028-02-29");
    expect(sumarMesesFecha("2026-10-31", 1)).toBe("2026-11-30");
  });

  it("arma rangos y valida formatos", () => {
    expect(rangoMeses("2026-11", 3)).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(esMes("2026-13")).toBe(false);
    expect(esFecha("2027-02-29")).toBe(false);
    expect(esFecha("2028-02-29")).toBe(true);
  });

  it("calcula hoy en la zona del hogar", () => {
    // 02:00 UTC del 1/11 todavía es 31/10 en Buenos Aires (UTC−3)
    expect(hoy("America/Argentina/Buenos_Aires", new Date("2026-11-01T02:00:00Z"))).toBe("2026-10-31");
  });
});

describe("dinero", () => {
  it("suma sin errores de punto flotante", () => {
    expect(sumar(["0.1", "0.2"]).toString()).toBe("0.3");
    expect(sumar([12345.67, 23456.78, 34567.89]).toString()).toBe("70370.34");
  });

  it("convierte USD a ARS con la cotización del movimiento", () => {
    expect(aMonedaBase("20", "USD", "ARS", "1415.5").toString()).toBe("28310");
    expect(aMonedaBase("100", "ARS", "ARS").toString()).toBe("100");
    expect(aMonedaBase("1000", "ARS", "USD", "1250").toString()).toBe("0.8");
  });

  it("exige cotización para convertir", () => {
    expect(() => aMonedaBase("20", "USD", "ARS")).toThrow(/cotización/);
    expect(() => aMonedaBase("20", "USD", "ARS", 0)).toThrow();
  });

  it("redondea a centavos y calcula porcentajes", () => {
    expect(centavos("10.005").toString()).toBe("10.01");
    expect(porcentaje(25, 200)).toBe(12.5);
    expect(porcentaje(1, 0)).toBeNull();
  });
});

describe("fecha de impacto", () => {
  it("las cuentas comunes impactan el mismo día", () => {
    expect(fechaImpacto("2026-10-15", { tipo: "billetera" })).toBe("2026-10-15");
  });

  it("la tarjeta sin cierre impacta el mes siguiente", () => {
    expect(fechaImpacto("2026-10-15", { tipo: "tarjeta_credito" })).toBe("2026-11-10");
    expect(fechaImpacto("2026-12-28", { tipo: "tarjeta_credito", diaVencimiento: 5 })).toBe("2027-01-05");
  });

  it("respeta el día de cierre", () => {
    const tarjeta = { tipo: "tarjeta_credito" as const, diaCierre: 25, diaVencimiento: 7 };
    expect(fechaImpacto("2026-10-25", tarjeta)).toBe("2026-11-07");
    expect(fechaImpacto("2026-10-26", tarjeta)).toBe("2026-12-07");
  });

  it("si vence el mismo mes en que cierra (cierra el 1, vence el 14)", () => {
    const tarjeta = { tipo: "tarjeta_credito" as const, diaCierre: 1, diaVencimiento: 14 };
    expect(fechaImpacto("2026-10-01", tarjeta)).toBe("2026-10-14");
    expect(fechaImpacto("2026-10-03", tarjeta)).toBe("2026-11-14");
    expect(fechaImpacto("2026-09-25", tarjeta)).toBe("2026-10-14");
  });
});

describe("recurrencias", () => {
  const mensual = { frecuencia: "mensual" as const, mesAncla: "2026-01", diaDelMes: 5 };

  it("una mensual ocurre todos los meses", () => {
    expect(periodos(mensual, "2026-10", "2027-01")).toEqual(["2026-10", "2026-11", "2026-12", "2027-01"]);
  });

  it("respeta la fase del ciclo (bimestral, trimestral, semestral)", () => {
    expect(periodos({ ...mensual, frecuencia: "bimestral", mesAncla: "2026-11" }, "2026-10", "2027-03")).toEqual([
      "2026-11",
      "2027-01",
      "2027-03",
    ]);
    expect(periodos({ ...mensual, frecuencia: "trimestral", mesAncla: "2026-10" }, "2026-10", "2027-04")).toEqual([
      "2026-10",
      "2027-01",
      "2027-04",
    ]);
    // aguinaldo: junio y diciembre
    expect(periodos({ ...mensual, frecuencia: "semestral", mesAncla: "2026-12" }, "2026-10", "2027-12")).toEqual([
      "2026-12",
      "2027-06",
      "2027-12",
    ]);
  });

  it("arranca en `desde` y termina en `fechaFin`", () => {
    const panales = { ...mensual, desde: "2026-12-01" };
    expect(ocurreEn(panales, "2026-11")).toBe(false);
    expect(ocurreEn(panales, "2026-12")).toBe(true);

    const planDePagos = { ...mensual, diaDelMes: 15, fechaFin: "2027-04-15" };
    expect(ocurreEn(planDePagos, "2027-04")).toBe(true);
    expect(ocurreEn(planDePagos, "2027-05")).toBe(false);
  });

  it("las inactivas no ocurren", () => {
    expect(ocurreEn({ ...mensual, activa: false }, "2026-10")).toBe(false);
  });

  it("prorratea por mes", () => {
    expect(montoMensual(90000, "bimestral").toString()).toBe("45000");
    expect(montoMensual(22000, "trimestral").toString()).toBe("7333.33");
    expect(prorrateoTotal([{ monto: 90000, frecuencia: "bimestral" }, { monto: 1000, frecuencia: "mensual" }]).toString()).toBe("46000");
  });
});

describe("cuotas", () => {
  it("genera N impactos mensuales", () => {
    const imp = impactosCuotas({ montoCuota: "4321.09", cantidadCuotas: 12, primeraFechaImpacto: "2026-11-10" });
    expect(imp).toHaveLength(12);
    expect(imp[0]).toMatchObject({ numero: 1, fechaImpacto: "2026-11-10" });
    expect(imp[11]).toMatchObject({ numero: 12, fechaImpacto: "2027-10-10" });
    expect(imp.reduce((a, c) => a.plus(c.monto), dec(0)).toString()).toBe("51853.08");
  });

  it("rechaza cantidades inválidas", () => {
    expect(() => impactosCuotas({ montoCuota: 1, cantidadCuotas: 0, primeraFechaImpacto: "2026-11-10" })).toThrow();
  });

  it("calcula las cuotas que quedan y la cuota de un mes", () => {
    expect(cuotasRestantes("2026-10", "2026-12")).toBe(3);
    expect(cuotasRestantes("2026-10", "2026-09")).toBe(0);
    const plan = { cantidadCuotas: 6, primeraFechaImpacto: "2026-11-10" };
    expect(cuotaDelMes(plan, "2026-11")).toBe(1);
    expect(cuotaDelMes(plan, "2027-04")).toBe(6);
    expect(cuotaDelMes(plan, "2027-05")).toBeNull();
  });
});

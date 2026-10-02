import { describe, expect, it } from "vitest";
import { dec } from "./dinero.js";
import { proyectar, type RecurrenciaProyeccion } from "./proyeccion.js";
import { resumenMes } from "./resumen.js";
import type { MovimientoCalc } from "./tipos.js";
import { efectoEnVista } from "./vistas.js";

// Familia ficticia: Ana (cobra sueldo) y Leo (de licencia, recibe transferencias de Ana).
const ANA = "ana";
const LEO = "leo";

let seq = 0;
function mov(p: Partial<MovimientoCalc> & Pick<MovimientoCalc, "tipo" | "fechaImpacto">): MovimientoCalc {
  return {
    id: `m${++seq}`,
    estado: "confirmado",
    monto: dec(p.monto ?? 0),
    categoriaId: null,
    duenoId: ANA,
    ...p,
  } as MovimientoCalc;
}

describe("vistas y transferencias", () => {
  const transferencia = mov({ tipo: "transferencia", fechaImpacto: "2026-10-05", monto: dec(100000), personaOrigenId: ANA, personaDestinoId: LEO });
  const entreCuentasPropias = mov({ tipo: "transferencia", fechaImpacto: "2026-10-05", monto: dec(5000), personaOrigenId: ANA, personaDestinoId: ANA });

  it("en el Hogar una transferencia no existe", () => {
    expect(efectoEnVista(transferencia, "hogar")).toBeNull();
  });

  it("en cada persona aparece como enviada o recibida", () => {
    expect(efectoEnVista(transferencia, ANA)).toBe("enviada");
    expect(efectoEnVista(transferencia, LEO)).toBe("recibida");
    expect(efectoEnVista(entreCuentasPropias, ANA)).toBeNull();
  });

  it("los omitidos no cuentan en ninguna vista", () => {
    expect(efectoEnVista(mov({ tipo: "gasto", fechaImpacto: "2026-10-01", estado: "omitido" }), "hogar")).toBeNull();
  });
});

describe("resumen del mes", () => {
  const movs = [
    mov({ tipo: "ingreso", fechaImpacto: "2026-10-03", monto: dec(1000000) }),
    // Ana le pasa plata a Leo para pagar la tarjeta de él…
    mov({ tipo: "transferencia", fechaImpacto: "2026-10-10", monto: dec(150000), personaOrigenId: ANA, personaDestinoId: LEO }),
    // …y el gasto real es el consumo en la tarjeta de Leo.
    mov({ tipo: "gasto", fechaImpacto: "2026-10-10", monto: dec(150000), duenoId: LEO, categoriaId: "auto" }),
    mov({ tipo: "gasto", fechaImpacto: "2026-10-01", monto: dec(400000), categoriaId: "alquiler" }),
    ...Array.from({ length: 7 }, (_, i) =>
      mov({ tipo: "gasto", fechaImpacto: `2026-10-${String(i + 10)}`, monto: dec(3000), categoriaId: "cafe" }),
    ),
    mov({ tipo: "gasto", fechaImpacto: "2026-10-20", monto: dec(50000), categoriaId: "super", estado: "pendiente" }),
    mov({ tipo: "gasto", fechaImpacto: "2026-11-01", monto: dec(999999), categoriaId: "alquiler" }),
  ];
  const raiz = (id: string) => (id === "cafe" ? "comida" : id);

  it("Hogar: no cuenta dos veces la transferencia", () => {
    const r = resumenMes(movs, { mes: "2026-10", vista: "hogar", raiz });
    expect(r.ingresos.toString()).toBe("1000000");
    expect(r.gastos.toString()).toBe("571000");
    expect(r.ahorro.toString()).toBe("429000");
    expect(r.tasaAhorro).toBe(42.9);
    expect(r.enviadas.isZero()).toBe(true);
  });

  it("agrupa por categoría raíz y arma el top", () => {
    const r = resumenMes(movs, { mes: "2026-10", vista: "hogar", raiz });
    expect(r.porCategoria.map((c) => c.categoriaId)).toEqual(["alquiler", "auto", "comida"]);
    expect(r.top5[0].porcentaje).toBe(70.1);
  });

  it("detecta gastos hormiga en la categoría hoja", () => {
    const r = resumenMes(movs, { mes: "2026-10", vista: "hogar", raiz, hormigaPromedioMaximo: dec(10000) });
    expect(r.hormiga).toHaveLength(1);
    expect(r.hormiga[0]).toMatchObject({ categoriaId: "cafe", cantidad: 7 });
    expect(r.hormiga[0].total.toString()).toBe("21000");
  });

  it("los pendientes se informan aparte", () => {
    const r = resumenMes(movs, { mes: "2026-10", vista: "hogar" });
    expect(r.pendientes.cantidad).toBe(1);
    expect(r.pendientes.gastos.toString()).toBe("50000");
  });

  it("vista persona: la transferencia es enviada/recibida, no gasto", () => {
    const ana = resumenMes(movs, { mes: "2026-10", vista: ANA });
    expect(ana.gastos.toString()).toBe("421000");
    expect(ana.enviadas.toString()).toBe("150000");
    expect(ana.ahorro.toString()).toBe("429000");

    const leo = resumenMes(movs, { mes: "2026-10", vista: LEO });
    expect(leo.gastos.toString()).toBe("150000");
    expect(leo.recibidas.toString()).toBe("150000");
    expect(leo.ahorro.isZero()).toBe(true);
    expect(leo.tasaAhorro).toBe(0);
  });
});

describe("proyección de flujo", () => {
  const billetera = { tipo: "billetera" as const };
  const tarjeta = { tipo: "tarjeta_credito" as const, diaVencimiento: 10 };

  const recurrencias: RecurrenciaProyeccion[] = [
    { id: "sueldo", concepto: "Sueldo", tipo: "ingreso", monto: 1000000, duenoId: ANA, cuenta: billetera, frecuencia: "mensual", mesAncla: "2026-01", diaDelMes: 5 },
    { id: "alquiler", concepto: "Alquiler", tipo: "gasto", monto: 400000, duenoId: ANA, cuenta: billetera, frecuencia: "mensual", mesAncla: "2026-01", diaDelMes: 1 },
    { id: "seguro", concepto: "Seguro (tarjeta)", tipo: "gasto", monto: 50000, duenoId: ANA, cuenta: tarjeta, frecuencia: "mensual", mesAncla: "2026-01", diaDelMes: 15 },
    { id: "patente", concepto: "Patente Leo", tipo: "gasto", monto: 30000, duenoId: LEO, cuenta: tarjeta, frecuencia: "trimestral", mesAncla: "2026-10", diaDelMes: 20 },
    { id: "bono", concepto: "Bono", tipo: "ingreso", monto: 250000, duenoId: ANA, cuenta: billetera, frecuencia: "trimestral", mesAncla: "2026-10", diaDelMes: 31 },
    { id: "pago", concepto: "Plan de pagos", tipo: "gasto", monto: 20000, duenoId: ANA, cuenta: billetera, frecuencia: "mensual", mesAncla: "2026-01", diaDelMes: 15, fechaFin: "2026-12-15" },
  ];

  const movimientos: MovimientoCalc[] = [
    // octubre: el sueldo ya se confirmó con el monto real y el alquiler está pendiente
    mov({ tipo: "ingreso", fechaImpacto: "2026-10-05", monto: dec(1020000), recurrenciaId: "sueldo", periodo: "2026-10", concepto: "Sueldo" }),
    mov({ tipo: "gasto", fechaImpacto: "2026-10-01", monto: dec(400000), recurrenciaId: "alquiler", periodo: "2026-10", estado: "pendiente" }),
    // el plan de pagos de octubre se omitió
    mov({ tipo: "gasto", fechaImpacto: "2026-10-15", monto: dec(20000), recurrenciaId: "pago", periodo: "2026-10", estado: "omitido" }),
    // una compra en 3 cuotas con tarjeta, materializada
    ...["2026-11-10", "2026-12-10", "2027-01-10"].map((fechaImpacto, i) =>
      mov({ tipo: "gasto", fechaImpacto, monto: dec(10000), planCuotasId: "silla", concepto: `Silla ${i + 1}/3` }),
    ),
    // gasto variable ya hecho en octubre
    mov({ tipo: "gasto", fechaImpacto: "2026-10-08", monto: dec(35000), concepto: "Delivery" }),
    // transferencia Ana → Leo
    mov({ tipo: "transferencia", fechaImpacto: "2026-10-12", monto: dec(60000), personaOrigenId: ANA, personaDestinoId: LEO }),
  ];

  const eventos = [
    { id: "madre", nombre: "Día de la Madre", mes: 10, monto: 60000 },
    { id: "fiestas", nombre: "Fiestas", mes: 12, monto: 300000 },
    { id: "viejo", nombre: "Desactivado", mes: 11, monto: 1, activo: false },
  ];

  const p = proyectar({ desde: "2026-10", meses: 6, vista: "hogar", umbral: 450000, recurrencias, movimientos, eventos });
  const mes = (m: string) => p.find((x) => x.mes === m)!;

  it("devuelve los meses pedidos", () => {
    expect(p.map((x) => x.mes)).toEqual(["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03"]);
  });

  it("octubre: lo real manda sobre lo estimado y no duplica recurrencias", () => {
    const oct = mes("2026-10");
    // sueldo real 1.020.000 (no el estimado) + bono estimado
    expect(oct.ingresos.toString()).toBe("1270000");
    // alquiler pendiente; el plan de pagos omitido no se estima; el seguro de septiembre impacta en octubre
    expect(oct.fijos.toString()).toBe("450000");
    expect(oct.variables.toString()).toBe("35000");
    expect(oct.eventos.toString()).toBe("60000");
    expect(oct.cuotas.isZero()).toBe(true);
    expect(oct.transferencias.isZero()).toBe(true);
    expect(oct.sobra.toString()).toBe("725000");
    expect(oct.lineas.some((l) => l.refId === "pago")).toBe(false);
  });

  it("noviembre: cuotas, tarjeta a mes vencido y patente trimestral", () => {
    const nov = mes("2026-11");
    expect(nov.ingresos.toString()).toBe("1000000");
    // alquiler + seguro (consumo oct) + plan de pagos + patente (consumo oct, tarjeta)
    expect(nov.fijos.toString()).toBe("500000");
    expect(nov.cuotas.toString()).toBe("10000");
    expect(nov.sobra.toString()).toBe("490000");
    expect(nov.alerta).toBe("ok");
  });

  it("diciembre: fiestas y alerta ámbar por margen bajo", () => {
    const dic = mes("2026-12");
    expect(dic.eventos.toString()).toBe("300000");
    // 1.000.000 − (alquiler 400.000 + seguro 50.000 + último pago 20.000) − cuota 10.000 − fiestas 300.000
    expect(dic.sobra.toString()).toBe("220000");
    expect(dic.alerta).toBe("ambar");
  });

  it("enero: termina el plan de pagos y vuelve el bono", () => {
    const ene = mes("2027-01");
    expect(ene.lineas.some((l) => l.refId === "pago")).toBe(false);
    expect(ene.ingresos.toString()).toBe("1250000");
    expect(ene.cuotas.toString()).toBe("10000");
  });

  it("acumula la sobra mes a mes", () => {
    expect(p[1].acumulado.toString()).toBe(p[0].sobra.plus(p[1].sobra).toString());
    expect(p[5].acumulado.toString()).toBe(p.reduce((a, x) => a.plus(x.sobra), dec(0)).toString());
  });

  it("marca en rojo los meses con sobra negativa", () => {
    const caro = proyectar({
      desde: "2026-11",
      meses: 1,
      vista: "hogar",
      umbral: 0,
      recurrencias,
      movimientos,
      eventos: [{ id: "x", nombre: "Viaje", mes: 11, monto: 2000000 }],
    });
    expect(caro[0].alerta).toBe("rojo");
  });

  it("vista persona: solo lo suyo y las transferencias netas", () => {
    const leo = proyectar({ desde: "2026-10", meses: 4, vista: LEO, umbral: 0, recurrencias, movimientos, eventos });
    expect(leo[0].transferencias.toString()).toBe("60000");
    expect(leo[0].ingresos.isZero()).toBe(true);
    // patente (consumo oct con tarjeta) impacta en noviembre, y la siguiente (enero) en febrero
    expect(leo[1].fijos.toString()).toBe("30000");
    expect(leo[2].fijos.isZero()).toBe(true);
    // los eventos sin dueño son del hogar
    expect(leo[0].eventos.isZero()).toBe(true);

    const ana = proyectar({ desde: "2026-10", meses: 1, vista: ANA, umbral: 0, recurrencias, movimientos, eventos });
    expect(ana[0].transferencias.toString()).toBe("-60000");
  });
});

describe("recurrencias variables (súper, nafta…)", () => {
  const billetera = { tipo: "billetera" as const };
  const tarjeta = { tipo: "tarjeta_credito" as const, diaVencimiento: 10 };
  const recurrencias: RecurrenciaProyeccion[] = [
    { id: "super", concepto: "Súper", tipo: "gasto", monto: 400000, duenoId: ANA, cuenta: billetera, frecuencia: "mensual", mesAncla: "2026-01", diaDelMes: 5, variable: true, categoriaId: "super" },
    { id: "nafta", concepto: "Nafta", tipo: "gasto", monto: 100000, duenoId: LEO, cuenta: tarjeta, frecuencia: "mensual", mesAncla: "2026-01", diaDelMes: 15, variable: true, categoriaId: "nafta" },
  ];
  const compra = (fechaImpacto: string, monto: number, categoriaId: string, duenoId = ANA) =>
    mov({ tipo: "gasto", fechaImpacto, monto: dec(monto), categoriaId, duenoId });

  it("descuenta lo ya cargado en la categoría: no cuenta dos veces", () => {
    const [oct] = proyectar({ desde: "2026-10", meses: 1, vista: "hogar", umbral: 0, recurrencias: recurrencias.slice(0, 1), movimientos: [compra("2026-10-03", 90000, "super"), compra("2026-10-09", 60000, "super")], eventos: [] });
    // 150.000 cargados + 250.000 que faltan = el estimado de 400.000
    expect(oct.variables.toString()).toBe("150000");
    expect(oct.fijos.toString()).toBe("250000");
    expect(oct.lineas.find((l) => l.refId === "super")?.monto.toString()).toBe("-250000");
  });

  it("si ya se gastó más que el estimado, no estima nada (y no resta de más)", () => {
    const [oct] = proyectar({ desde: "2026-10", meses: 1, vista: "hogar", umbral: 0, recurrencias: recurrencias.slice(0, 1), movimientos: [compra("2026-10-03", 450000, "super")], eventos: [] });
    expect(oct.variables.toString()).toBe("450000");
    expect(oct.fijos.isZero()).toBe(true);
  });

  it("con tarjeta compara por mes de impacto y respeta la vista", () => {
    // nafta de septiembre con tarjeta impacta en octubre
    const movs = [compra("2026-10-10", 30000, "nafta", LEO), compra("2026-10-05", 999, "otra")];
    const [oct] = proyectar({ desde: "2026-10", meses: 1, vista: LEO, umbral: 0, recurrencias, movimientos: movs, eventos: [] });
    expect(oct.variables.toString()).toBe("30000");
    expect(oct.fijos.toString()).toBe("70000");
  });

  it("los meses futuros sin compras estiman el total", () => {
    const p = proyectar({ desde: "2026-10", meses: 2, vista: "hogar", umbral: 0, recurrencias: recurrencias.slice(0, 1), movimientos: [compra("2026-10-03", 90000, "super")], eventos: [] });
    expect(p[1].fijos.toString()).toBe("400000");
  });
});

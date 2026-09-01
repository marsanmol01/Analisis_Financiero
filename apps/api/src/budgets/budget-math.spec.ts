import { computeAlertLevel, computePercentageConsumed, daysInMonth, projectToMonthEnd } from "./budget-math";

describe("computePercentageConsumed", () => {
  it("calcula el porcentaje consumido", () => {
    expect(computePercentageConsumed(150, 200)).toBeCloseTo(75, 1);
  });

  it("puede superar el 100%", () => {
    expect(computePercentageConsumed(250, 200)).toBeCloseTo(125, 1);
  });

  it("devuelve 0 si el presupuesto es 0 o negativo (defensivo, no debería ocurrir tras validar el DTO)", () => {
    expect(computePercentageConsumed(50, 0)).toBe(0);
  });
});

describe("computeAlertLevel", () => {
  it("sin alerta por debajo del 70%", () => {
    expect(computeAlertLevel(69.9)).toBeNull();
  });

  it.each([
    [70, 70],
    [79.9, 70],
    [80, 80],
    [89.9, 80],
    [90, 90],
    [99.9, 90],
    [100, 100],
    [150, 100],
  ])("percentageConsumed=%p -> alertLevel=%p", (percentage, expected) => {
    expect(computeAlertLevel(percentage)).toBe(expected);
  });
});

describe("daysInMonth", () => {
  it("febrero de un año bisiesto tiene 29 días", () => {
    expect(daysInMonth("2028-02")).toBe(29);
  });

  it("febrero de un año no bisiesto tiene 28 días", () => {
    expect(daysInMonth("2026-02")).toBe(28);
  });

  it("agosto tiene 31 días", () => {
    expect(daysInMonth("2026-08")).toBe(31);
  });
});

describe("projectToMonthEnd", () => {
  it("proyecta linealmente el gasto a fin de mes", () => {
    // 500 gastados en 10 dias, mes de 30 dias -> 1500 proyectado
    expect(projectToMonthEnd(500, 10, 30)).toBeCloseTo(1500, 1);
  });

  it("devuelve 0 si el dia del mes es 0 o negativo", () => {
    expect(projectToMonthEnd(500, 0, 30)).toBe(0);
  });
});

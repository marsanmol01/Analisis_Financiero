import {
  bucketByMonth,
  computeSavingsRate,
  lastMonthKeys,
  monthKeyOf,
  monthKeyRange,
  percentChange,
  previousMonthKey,
} from "./analytics-math";

describe("computeSavingsRate", () => {
  it("calcula el ejemplo del enunciado (3.250 ingresos, 2.180 gastos -> 32,9%)", () => {
    expect(computeSavingsRate(3250, 2180)).toBeCloseTo(32.9, 1);
  });

  it("devuelve null si no hay ingresos (evita division por cero)", () => {
    expect(computeSavingsRate(0, 100)).toBeNull();
  });

  it("puede ser negativa si los gastos superan a los ingresos", () => {
    expect(computeSavingsRate(1000, 1500)).toBeCloseTo(-50, 1);
  });
});

describe("monthKeyOf / monthKeyRange / previousMonthKey", () => {
  it("formatea YYYY-MM en UTC", () => {
    expect(monthKeyOf(new Date("2026-03-15T23:00:00Z"))).toBe("2026-03");
  });

  it("calcula el rango [inicio, fin exclusivo) de un mes", () => {
    const { from, to } = monthKeyRange("2026-02");
    expect(from.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("calcula correctamente el mes anterior cruzando de año", () => {
    expect(previousMonthKey("2026-01")).toBe("2025-12");
  });
});

describe("lastMonthKeys", () => {
  it("genera las N claves en orden ascendente terminando en el mes de referencia", () => {
    expect(lastMonthKeys(3, "2026-03")).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("cruza el cambio de año correctamente", () => {
    expect(lastMonthKeys(4, "2026-01")).toEqual(["2025-10", "2025-11", "2025-12", "2026-01"]);
  });
});

describe("bucketByMonth", () => {
  it("suma ingresos y gastos por mes y calcula la tasa de ahorro", () => {
    const result = bucketByMonth(
      [
        { date: new Date("2026-08-05"), amount: 3250, isIncome: true, isExpense: false },
        { date: new Date("2026-08-10"), amount: -2180, isIncome: false, isExpense: true },
        { date: new Date("2026-09-01"), amount: 1000, isIncome: true, isExpense: false },
      ],
      ["2026-08", "2026-09"],
    );

    expect(result).toEqual([
      { month: "2026-08", income: 3250, expenses: 2180, savings: 1070, savingsRate: 32.9 },
      { month: "2026-09", income: 1000, expenses: 0, savings: 1000, savingsRate: 100 },
    ]);
  });

  it("ignora transacciones fuera de las claves de mes solicitadas", () => {
    const result = bucketByMonth(
      [{ date: new Date("2025-01-01"), amount: 500, isIncome: true, isExpense: false }],
      ["2026-08"],
    );
    expect(result).toEqual([{ month: "2026-08", income: 0, expenses: 0, savings: 0, savingsRate: null }]);
  });

  it("un mes sin movimientos devuelve ceros, no un hueco", () => {
    const result = bucketByMonth([], ["2026-08"]);
    expect(result).toEqual([{ month: "2026-08", income: 0, expenses: 0, savings: 0, savingsRate: null }]);
  });
});

describe("percentChange", () => {
  it("calcula un incremento porcentual", () => {
    expect(percentChange(120, 100)).toBeCloseTo(20, 1);
  });

  it("calcula una caida porcentual", () => {
    expect(percentChange(80, 100)).toBeCloseTo(-20, 1);
  });

  it("devuelve null si la referencia es cero", () => {
    expect(percentChange(50, 0)).toBeNull();
  });
});

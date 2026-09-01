import { computeAvailableMoney, computeDailyBudget, daysRemainingInMonth } from "./dashboard-math";

describe("computeAvailableMoney", () => {
  it("calcula el ejemplo del enunciado: 5.000 - 840 - 1.000 = 3.160", () => {
    const result = computeAvailableMoney({
      liquidBalance: 5000,
      pendingRecurringPayments: 840,
      savingsGoalsMonthlyNeeded: 1000,
    });
    expect(result).toBe(3160);
  });

  it("puede ser negativo si los compromisos superan el saldo disponible", () => {
    const result = computeAvailableMoney({
      liquidBalance: 100,
      pendingRecurringPayments: 200,
      savingsGoalsMonthlyNeeded: 0,
    });
    expect(result).toBe(-100);
  });
});

describe("daysRemainingInMonth", () => {
  it("el primer dia de un mes de 31 dias quedan 31 dias por delante", () => {
    expect(daysRemainingInMonth(new Date("2026-08-01"))).toBe(31);
  });

  it("el ultimo dia del mes queda 1 dia (hoy mismo, inclusive)", () => {
    expect(daysRemainingInMonth(new Date("2026-08-31"))).toBe(1);
  });

  it("a mitad de un mes de 30 dias", () => {
    expect(daysRemainingInMonth(new Date("2026-09-15"))).toBe(16);
  });
});

describe("computeDailyBudget", () => {
  it("reparte el dinero disponible entre los dias restantes", () => {
    // 3.160 disponibles / 30 dias restantes ~= 105.33, cercano al ejemplo del enunciado (105/dia)
    expect(computeDailyBudget(3160, 30)).toBeCloseTo(105.33, 1);
  });

  it("devuelve null si no quedan dias (defensivo)", () => {
    expect(computeDailyBudget(1000, 0)).toBeNull();
  });
});

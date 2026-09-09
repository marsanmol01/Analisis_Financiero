import { buildInsights, type InsightPeriod } from "./insights";

function period(overrides: Partial<InsightPeriod> = {}): InsightPeriod {
  return {
    income: 2000,
    expenses: 1200,
    savingsRate: 40,
    byCategory: [],
    ...overrides,
  };
}

describe("buildInsights", () => {
  it("sin datos suficientes, no genera ningún consejo", () => {
    const insights = buildInsights({
      periodLabel: "este mes",
      current: period({ expenses: 0, byCategory: [] }),
      previous: null,
      averageSavingsRate: null,
    });
    expect(insights).toEqual([]);
  });

  it("avisa si se ha gastado más de lo ingresado, con prioridad sobre el resto", () => {
    const insights = buildInsights({
      periodLabel: "este mes",
      current: period({ income: 1000, expenses: 1500, savingsRate: -50 }),
      previous: null,
      averageSavingsRate: null,
    });
    expect(insights[0].severity).toBe("warning");
    expect(insights[0].message).toContain("500€ más de lo que has ingresado");
  });

  it("avisa si la tasa de ahorro es notablemente menor que la media", () => {
    const insights = buildInsights({
      periodLabel: "este mes",
      current: period({ savingsRate: 10 }),
      previous: null,
      averageSavingsRate: 30,
    });
    expect(insights.some((i) => i.severity === "warning" && i.message.includes("menor que tu media"))).toBe(true);
  });

  it("felicita si la tasa de ahorro supera claramente la media", () => {
    const insights = buildInsights({
      periodLabel: "este mes",
      current: period({ savingsRate: 40 }),
      previous: null,
      averageSavingsRate: 30,
    });
    expect(insights.some((i) => i.severity === "positive" && i.message.includes("supera tu media"))).toBe(true);
  });

  it("no dice nada sobre la tasa de ahorro si la diferencia con la media es pequeña", () => {
    const insights = buildInsights({
      periodLabel: "este mes",
      current: period({ savingsRate: 32 }),
      previous: null,
      averageSavingsRate: 30,
    });
    expect(insights.some((i) => i.message.includes("media"))).toBe(false);
  });

  it("identifica la categoría de mayor gasto y su porcentaje del total", () => {
    const insights = buildInsights({
      periodLabel: "este ciclo",
      current: period({
        expenses: 1000,
        byCategory: [
          { categoryId: "cat-1", categoryName: "Vivienda", total: 600 },
          { categoryId: "cat-2", categoryName: "Ocio", total: 400 },
        ],
      }),
      previous: null,
      averageSavingsRate: null,
    });
    const info = insights.find((i) => i.severity === "info");
    expect(info?.message).toContain('"Vivienda": 600€ (60% del total)');
  });

  it("detecta la categoría con mayor incremento absoluto y porcentual frente al periodo anterior", () => {
    const insights = buildInsights({
      periodLabel: "este mes",
      current: period({
        expenses: 500,
        byCategory: [{ categoryId: "cat-1", categoryName: "Restaurantes", total: 200 }],
      }),
      previous: period({
        expenses: 300,
        byCategory: [{ categoryId: "cat-1", categoryName: "Restaurantes", total: 100 }],
      }),
      averageSavingsRate: null,
    });
    // "Restaurantes" tambien es la categoria de mayor gasto (consejo "info" aparte): hay que
    // distinguir el aviso de incremento ("warning") del de mayor gasto por severidad, no solo
    // por el nombre de la categoria, que aparece en los dos.
    const warning = insights.find((i) => i.severity === "warning" && i.message.includes("Restaurantes"));
    expect(warning?.message).toContain("100€ más");
    expect(warning?.message).toContain("+100%");
  });

  it("ignora incrementos pequeños en importe absoluto aunque el porcentaje sea alto", () => {
    const insights = buildInsights({
      periodLabel: "este mes",
      current: period({ byCategory: [{ categoryId: "cat-1", categoryName: "Parking", total: 10 }] }),
      previous: period({ byCategory: [{ categoryId: "cat-1", categoryName: "Parking", total: 2 }] }),
      averageSavingsRate: null,
    });
    // Parking sigue siendo la categoria de mayor gasto (consejo "info" legitimo); lo que no debe
    // aparecer es un aviso de incremento para ella.
    expect(insights.some((i) => i.severity === "warning" && i.message.includes("Parking"))).toBe(false);
  });

  it("una categoría nueva (sin gasto previo) cuenta como incremento del 100%", () => {
    const insights = buildInsights({
      periodLabel: "este mes",
      current: period({ byCategory: [{ categoryId: "cat-1", categoryName: "Viajes", total: 300 }] }),
      previous: period({ byCategory: [] }),
      averageSavingsRate: null,
    });
    const warning = insights.find((i) => i.severity === "warning" && i.message.includes("Viajes"));
    expect(warning?.message).toContain("+100%");
  });
});

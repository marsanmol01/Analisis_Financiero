import { detectRecurringPattern, monthlyEquivalent, RecurringCandidateTransaction } from "./recurring-detector";

function tx(id: string, date: string, amount: number): RecurringCandidateTransaction {
  return { id, date: new Date(date), amount };
}

describe("detectRecurringPattern", () => {
  it("detecta una suscripcion mensual con importe estable (Netflix)", () => {
    const pattern = detectRecurringPattern([
      tx("t1", "2026-05-15", -12.99),
      tx("t2", "2026-06-15", -12.99),
      tx("t3", "2026-07-15", -12.99),
      tx("t4", "2026-08-15", -12.99),
    ]);

    expect(pattern).not.toBeNull();
    expect(pattern?.frequency).toBe("MONTHLY");
    expect(pattern?.typicalAmount).toBeCloseTo(-12.99);
    expect(pattern?.transactionIds).toEqual(["t1", "t2", "t3", "t4"]);
    expect(pattern?.nextEstimatedDate.toISOString().slice(0, 10)).toBe("2026-09-14");
  });

  it("detecta una frecuencia anual (seguro)", () => {
    const pattern = detectRecurringPattern([tx("t1", "2024-03-01", -450), tx("t2", "2025-03-03", -460)]);

    expect(pattern?.frequency).toBe("ANNUAL");
  });

  it("detecta una frecuencia semanal", () => {
    const pattern = detectRecurringPattern([
      tx("t1", "2026-08-01", -20),
      tx("t2", "2026-08-08", -20),
      tx("t3", "2026-08-15", -20),
    ]);

    expect(pattern?.frequency).toBe("WEEKLY");
  });

  it("con menos de 2 ocurrencias no hay patron", () => {
    expect(detectRecurringPattern([tx("t1", "2026-08-01", -20)])).toBeNull();
  });

  it("si los importes varian demasiado (>20%), no se considera recurrente", () => {
    const pattern = detectRecurringPattern([
      tx("t1", "2026-06-01", -20),
      tx("t2", "2026-07-01", -20),
      tx("t3", "2026-08-01", -60), // muy distinto: compra ocasional, no suscripcion
    ]);

    expect(pattern).toBeNull();
  });

  it("si los intervalos son demasiado irregulares, no se considera recurrente", () => {
    const pattern = detectRecurringPattern([
      tx("t1", "2026-01-05", -20),
      tx("t2", "2026-01-20", -20), // 15 dias
      tx("t3", "2026-06-01", -20), // 132 dias: nada que ver con el intervalo anterior
    ]);

    expect(pattern).toBeNull();
  });

  it("clasifica como OTHER un intervalo consistente que no encaja en ningun periodo estandar (cada 45 dias) con suficientes ocurrencias", () => {
    const pattern = detectRecurringPattern([
      tx("t1", "2026-01-01", -75),
      tx("t2", "2026-02-15", -75), // 45 dias
      tx("t3", "2026-04-01", -75), // 45 dias
    ]);

    expect(pattern?.frequency).toBe("OTHER");
  });

  it("con solo 2 ocurrencias y un intervalo que no encaja en ningun periodo estandar, no hay patron (se exigen 3 para OTHER)", () => {
    const pattern = detectRecurringPattern([tx("t1", "2026-01-01", -75), tx("t2", "2026-02-15", -75)]);

    expect(pattern).toBeNull();
  });

  it("la confianza aumenta con mas ocurrencias, para el mismo nivel de consistencia", () => {
    const pocasOcurrencias = detectRecurringPattern([tx("t1", "2026-06-15", -10), tx("t2", "2026-07-15", -10)]);
    const masOcurrencias = detectRecurringPattern([
      tx("t1", "2026-04-15", -10),
      tx("t2", "2026-05-15", -10),
      tx("t3", "2026-06-15", -10),
      tx("t4", "2026-07-15", -10),
      tx("t5", "2026-08-15", -10),
    ]);

    expect(masOcurrencias!.confidence).toBeGreaterThan(pocasOcurrencias!.confidence);
  });

  it("conserva el signo original del importe (ingreso recurrente en positivo)", () => {
    const pattern = detectRecurringPattern([tx("t1", "2026-06-01", 1500), tx("t2", "2026-07-01", 1500)]);
    expect(pattern?.typicalAmount).toBeGreaterThan(0);
  });
});

describe("monthlyEquivalent", () => {
  it("una cuota anual se reparte entre 12 meses", () => {
    expect(monthlyEquivalent(-1200, "ANNUAL")).toBeCloseTo(-98.63, 1);
  });

  it("una cuota mensual se queda igual", () => {
    expect(monthlyEquivalent(-12.99, "MONTHLY")).toBeCloseTo(-12.99, 1);
  });

  it("una cuota semanal se multiplica aproximadamente por 4.3", () => {
    expect(monthlyEquivalent(-20, "WEEKLY")).toBeCloseTo(-85.71, 1);
  });
});

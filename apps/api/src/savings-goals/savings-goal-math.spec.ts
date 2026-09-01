import { computeGoalProgress } from "./savings-goal-math";

describe("computeGoalProgress", () => {
  it("calcula el ejemplo del enunciado: fondo de emergencia de 10.000 a 15.000, a mitad de camino y a tiempo", () => {
    const progress = computeGoalProgress({
      targetAmount: 15000,
      initialAmount: 10000,
      currentAmount: 12500, // mitad del camino entre 10000 y 15000
      startDate: new Date("2026-01-01"),
      targetDate: new Date("2027-01-01"),
      today: new Date("2026-07-01"), // aprox mitad del periodo
    });

    expect(progress.savedSoFar).toBeCloseTo(2500, 0);
    expect(progress.remainingAmount).toBeCloseTo(2500, 0);
    expect(progress.progressPercent).toBeCloseTo(50, 0);
    expect(progress.isOnTrack).toBe(true);
    expect(progress.isComplete).toBe(false);
  });

  it("un objetivo recien creado sin ahorro previo empieza en 0%", () => {
    const progress = computeGoalProgress({
      targetAmount: 12000,
      initialAmount: 0,
      currentAmount: 0,
      startDate: new Date("2026-01-01"),
      targetDate: new Date("2027-01-01"),
      today: new Date("2026-01-01"),
    });

    expect(progress.progressPercent).toBe(0);
    expect(progress.savedSoFar).toBe(0);
  });

  it("marca isComplete cuando se alcanza o supera el importe objetivo", () => {
    const progress = computeGoalProgress({
      targetAmount: 5000,
      initialAmount: 0,
      currentAmount: 5000,
      startDate: new Date("2026-01-01"),
      targetDate: new Date("2026-06-01"),
      today: new Date("2026-03-01"),
    });

    expect(progress.progressPercent).toBe(100);
    expect(progress.isComplete).toBe(true);
    expect(progress.remainingAmount).toBe(0);
  });

  it("detecta que va por detras del ritmo esperado (deviation negativa)", () => {
    const progress = computeGoalProgress({
      targetAmount: 12000,
      initialAmount: 0,
      currentAmount: 1000, // deberia llevar ~6000 a mitad de año
      startDate: new Date("2026-01-01"),
      targetDate: new Date("2027-01-01"),
      today: new Date("2026-07-01"),
    });

    expect(progress.isOnTrack).toBe(false);
    expect(progress.deviation).toBeLessThan(0);
  });

  it("calcula el ahorro mensual necesario para llegar a tiempo", () => {
    const progress = computeGoalProgress({
      targetAmount: 12000,
      initialAmount: 0,
      currentAmount: 6000,
      startDate: new Date("2026-01-01"),
      targetDate: new Date("2027-01-01"),
      today: new Date("2026-07-01"), // ~6 meses restantes
    });

    // El calculo usa un mes "medio" (365.25/12 dias) para evitar la aritmetica de calendario
    // (dias de mes variables); de ahi que no sea exactamente 1000 = 6000/6, sino un valor
    // cercano. Tolerancia amplia deliberada: documenta esa aproximacion, no un bug.
    expect(progress.monthlyContributionNeeded).toBeGreaterThan(950);
    expect(progress.monthlyContributionNeeded).toBeLessThan(1050);
  });

  it("devuelve null en el ahorro mensual necesario si ya paso la fecha limite", () => {
    const progress = computeGoalProgress({
      targetAmount: 12000,
      initialAmount: 0,
      currentAmount: 6000,
      startDate: new Date("2025-01-01"),
      targetDate: new Date("2026-01-01"),
      today: new Date("2026-06-01"), // posterior a la fecha limite
    });

    expect(progress.monthlyContributionNeeded).toBeNull();
  });

  it("proyecta la fecha de finalizacion segun el ritmo real de ahorro", () => {
    const progress = computeGoalProgress({
      targetAmount: 12000,
      initialAmount: 0,
      currentAmount: 6000, // ritmo: 1000/mes en 6 meses
      startDate: new Date("2026-01-01"),
      targetDate: new Date("2027-01-01"),
      today: new Date("2026-07-01"),
    });

    // A ese ritmo (~1000/mes), completar los 12000 llevaria ~12 meses desde el inicio -> finales
    // de 2026 / principios de 2027, con el mismo margen del mes "medio" que en el test anterior.
    expect(["2026-12", "2027-01"]).toContain(progress.projectedCompletionDate?.toISOString().slice(0, 7));
  });

  it("no proyecta fecha de finalizacion si todavia no se ha ahorrado nada", () => {
    const progress = computeGoalProgress({
      targetAmount: 12000,
      initialAmount: 0,
      currentAmount: 0,
      startDate: new Date("2026-01-01"),
      targetDate: new Date("2027-01-01"),
      today: new Date("2026-07-01"),
    });

    expect(progress.projectedCompletionDate).toBeNull();
  });
});

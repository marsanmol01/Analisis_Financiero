// Calculos puros sobre el progreso de un objetivo de ahorro, testeados sin base de datos.
//
// Los "meses" se miden como duraciones de 365.25/12 dias (un mes "medio"), no con aritmetica
// de calendario (que tendria que lidiar con meses de 28-31 dias y overflow de dia-de-mes al
// sumar meses). Es una aproximacion deliberada: introduce un margen de error de hasta ~3 dias
// por mes en los calculos de ritmo/proyeccion, aceptable para una cifra orientativa de ahorro.

export interface GoalMathInput {
  targetAmount: number;
  initialAmount: number;
  currentAmount: number; // progreso actual: saldo de la cuenta vinculada, o importe manual
  startDate: Date;
  targetDate: Date;
  today: Date;
}

export interface GoalProgress {
  savedSoFar: number;
  remainingAmount: number;
  progressPercent: number;
  monthlyContributionNeeded: number | null; // null si ya se paso la fecha limite
  expectedSavedByNow: number;
  deviation: number; // savedSoFar - expectedSavedByNow; positivo = por delante del ritmo esperado
  isOnTrack: boolean;
  projectedCompletionDate: Date | null; // null si el ritmo actual es <= 0 (no se puede proyectar)
  isComplete: boolean;
}

const MS_PER_MONTH = (365.25 / 12) * 24 * 60 * 60 * 1000;

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_MONTH;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getTime() + months * MS_PER_MONTH);
}

export function computeGoalProgress(input: GoalMathInput): GoalProgress {
  const { targetAmount, initialAmount, currentAmount, startDate, targetDate, today } = input;

  const totalNeeded = targetAmount - initialAmount;
  const savedSoFar = round2(currentAmount - initialAmount);
  const remainingAmount = round2(targetAmount - currentAmount);
  const progressPercent = totalNeeded !== 0 ? Math.round((savedSoFar / totalNeeded) * 1000) / 10 : 100;

  const monthsToDeadline = monthsBetween(today, targetDate);
  const monthlyContributionNeeded = monthsToDeadline > 0 ? round2(remainingAmount / monthsToDeadline) : null;

  const totalMonths = monthsBetween(startDate, targetDate);
  const elapsedMonths = monthsBetween(startDate, today);
  const elapsedRatio = totalMonths > 0 ? Math.min(1, Math.max(0, elapsedMonths / totalMonths)) : 1;
  const expectedSavedByNow = round2(elapsedRatio * totalNeeded);
  const deviation = round2(savedSoFar - expectedSavedByNow);

  let projectedCompletionDate: Date | null = null;
  if (elapsedMonths > 0 && savedSoFar > 0) {
    const monthlyPace = savedSoFar / elapsedMonths;
    if (monthlyPace > 0) {
      projectedCompletionDate = addMonths(startDate, totalNeeded / monthlyPace);
    }
  }

  return {
    savedSoFar,
    remainingAmount,
    progressPercent,
    monthlyContributionNeeded,
    expectedSavedByNow,
    deviation,
    isOnTrack: deviation >= 0,
    projectedCompletionDate,
    isComplete: progressPercent >= 100,
  };
}

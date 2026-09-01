// Deteccion de patrones recurrentes, pura (sin base de datos) y por tanto facil de testear a
// fondo. Agrupa por comercio/descripcion se hace fuera de este modulo (en el servicio); aqui
// solo se analiza UN grupo ya formado: sus ocurrencias, su regularidad temporal y de importe.

export type RecurringFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "OTHER";

export interface RecurringCandidateTransaction {
  id: string;
  date: Date;
  amount: number; // con signo (negativo = gasto)
}

export interface DetectedRecurringPattern {
  frequency: RecurringFrequency;
  typicalAmount: number; // con el mismo signo que las transacciones de origen
  lastDate: Date;
  nextEstimatedDate: Date;
  confidence: number;
  transactionIds: string[];
}

const MIN_OCCURRENCES = 2;
const MIN_OCCURRENCES_FOR_OTHER = 3;
const MAX_AMOUNT_DEVIATION_RATIO = 0.2; // +-20%
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const FREQUENCY_BUCKETS: { frequency: RecurringFrequency; targetDays: number; toleranceDays: number }[] = [
  { frequency: "WEEKLY", targetDays: 7, toleranceDays: 2 },
  { frequency: "MONTHLY", targetDays: 30, toleranceDays: 5 },
  { frequency: "QUARTERLY", targetDays: 91, toleranceDays: 10 },
  { frequency: "SEMIANNUAL", targetDays: 182, toleranceDays: 15 },
  { frequency: "ANNUAL", targetDays: 365, toleranceDays: 20 },
];

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / MS_PER_DAY;
}

function classifyFrequency(avgDays: number): { frequency: RecurringFrequency; bucket: (typeof FREQUENCY_BUCKETS)[number] | null } {
  for (const bucket of FREQUENCY_BUCKETS) {
    if (Math.abs(avgDays - bucket.targetDays) <= bucket.toleranceDays) {
      return { frequency: bucket.frequency, bucket };
    }
  }
  return { frequency: "OTHER", bucket: null };
}

// Devuelve null si el grupo no parece realmente recurrente (importes demasiado dispares,
// intervalos demasiado irregulares, o muy pocas ocurrencias).
export function detectRecurringPattern(transactions: RecurringCandidateTransaction[]): DetectedRecurringPattern | null {
  if (transactions.length < MIN_OCCURRENCES) return null;

  const sorted = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());
  const amounts = sorted.map((t) => Math.abs(t.amount));
  const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
  if (avgAmount === 0) return null;

  const deviations = amounts.map((a) => Math.abs(a - avgAmount) / avgAmount);
  if (deviations.some((d) => d > MAX_AMOUNT_DEVIATION_RATIO)) return null;

  const diffs: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    diffs.push(daysBetween(sorted[i - 1].date, sorted[i].date));
  }
  const avgDays = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;

  const { frequency, bucket } = classifyFrequency(avgDays);

  if (bucket) {
    // No basta con que la media encaje: cada intervalo individual debe acercarse tambien al
    // periodo detectado (con algo mas de margen que el bucket base).
    const allDiffsMatch = diffs.every((d) => Math.abs(d - bucket.targetDays) <= bucket.toleranceDays * 1.5);
    if (!allDiffsMatch) return null;
  } else {
    // Sin encajar en un periodo estandar, exigimos mas ocurrencias y que los intervalos no
    // varien demasiado entre si, para no marcar como recurrente algo irregular por azar.
    if (sorted.length < MIN_OCCURRENCES_FOR_OTHER) return null;
    const maxDiff = Math.max(...diffs);
    const minDiff = Math.min(...diffs);
    if (maxDiff - minDiff > avgDays * 0.5) return null;
  }

  const typicalAmountAbs = median(amounts);
  const sign = sorted[0].amount < 0 ? -1 : 1;
  const lastDate = sorted[sorted.length - 1].date;
  const nextEstimatedDate = new Date(lastDate.getTime() + avgDays * MS_PER_DAY);

  const occurrenceFactor = Math.min(1, sorted.length / 5);
  const avgDeviation = deviations.reduce((sum, d) => sum + d, 0) / deviations.length;
  const amountConsistencyFactor = 1 - Math.min(1, avgDeviation / MAX_AMOUNT_DEVIATION_RATIO);
  const rawConfidence = occurrenceFactor * 0.6 + amountConsistencyFactor * 0.4;
  const confidence = Math.round(Math.max(0.3, Math.min(1, rawConfidence)) * 1000) / 1000;

  return {
    frequency,
    typicalAmount: sign * typicalAmountAbs,
    lastDate,
    nextEstimatedDate,
    confidence,
    transactionIds: sorted.map((t) => t.id),
  };
}

// Coste mensual equivalente, para comparar recurrentes de distinta frecuencia entre si.
export function monthlyEquivalent(typicalAmount: number, frequency: RecurringFrequency, avgDaysOverride?: number): number {
  const daysByFrequency: Record<RecurringFrequency, number> = {
    WEEKLY: 7,
    MONTHLY: 30,
    QUARTERLY: 91,
    SEMIANNUAL: 182,
    ANNUAL: 365,
    OTHER: avgDaysOverride ?? 30,
  };
  const days = daysByFrequency[frequency];
  return (typicalAmount / days) * 30;
}

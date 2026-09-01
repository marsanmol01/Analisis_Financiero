// Calculos puros sobre el progreso de un presupuesto, testeados sin base de datos.

export type AlertLevel = 70 | 80 | 90 | 100 | null;

const ALERT_THRESHOLDS = [100, 90, 80, 70] as const;

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Ninguna alerta si no se alcanza ni el umbral mas bajo (70%). Se devuelve el mas alto superado.
export function computeAlertLevel(percentageConsumed: number): AlertLevel {
  for (const threshold of ALERT_THRESHOLDS) {
    if (percentageConsumed >= threshold) return threshold;
  }
  return null;
}

// Porcentaje consumido del presupuesto. Sin limite superior: puede superar el 100%.
export function computePercentageConsumed(spent: number, amount: number): number {
  if (amount <= 0) return 0;
  return Math.round((spent / amount) * 1000) / 10; // 1 decimal
}

export function daysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Proyeccion lineal a fin de mes por regla de tres sobre lo gastado hasta el dia actual del mes.
// Solo tiene sentido para el mes en curso (dayOfMonth entre 1 y el total de dias del mes).
export function projectToMonthEnd(spentSoFar: number, dayOfMonth: number, totalDaysInMonth: number): number {
  if (dayOfMonth <= 0) return 0;
  return round2((spentSoFar / dayOfMonth) * totalDaysInMonth);
}

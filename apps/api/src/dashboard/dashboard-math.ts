// Calculos puros del dashboard ("dinero realmente disponible" y presupuesto por dia),
// testeados sin base de datos.

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface AvailableMoneyInput {
  liquidBalance: number;
  pendingRecurringPayments: number; // magnitud positiva a restar
  savingsGoalsMonthlyNeeded: number; // magnitud positiva a restar
}

// Saldo disponible - pagos recurrentes pendientes - aportacion mensual necesaria a objetivos.
export function computeAvailableMoney(input: AvailableMoneyInput): number {
  return round2(input.liquidBalance - input.pendingRecurringPayments - input.savingsGoalsMonthlyNeeded);
}

export function daysRemainingInMonth(today: Date): number {
  const lastDayOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate();
  return lastDayOfMonth - today.getUTCDate() + 1; // inclusivo del dia de hoy
}

export function computeDailyBudget(availableMoney: number, remainingDays: number): number | null {
  if (remainingDays <= 0) return null;
  return round2(availableMoney / remainingDays);
}

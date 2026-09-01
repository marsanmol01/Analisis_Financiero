// Calculos puros (sin base de datos) sobre agregados ya extraidos de la BD, para poder
// testearlos a fondo sin depender de Postgres.

export interface MonthlyAmounts {
  month: string; // "YYYY-MM"
  income: number;
  expenses: number; // en positivo (magnitud gastada)
  savings: number;
  savingsRate: number | null;
}

export interface BucketableTransaction {
  date: Date;
  amount: number;
  isIncome: boolean;
  isExpense: boolean;
}

// tasa de ahorro = (ingresos - gastos) / ingresos * 100. Sin ingresos, no tiene sentido (null),
// para no mostrar un porcentaje enganoso ni dividir por cero.
export function computeSavingsRate(income: number, expenses: number): number | null {
  if (income <= 0) return null;
  return Math.round(((income - expenses) / income) * 1000) / 10; // 1 decimal
}

export function monthKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Genera las N claves de mes (incluido el de referencia) en orden cronologico ascendente.
export function lastMonthKeys(count: number, referenceMonth: string): string[] {
  const [year, month] = referenceMonth.split("-").map(Number);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    keys.push(monthKeyOf(d));
  }
  return keys;
}

export function previousMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 2, 1));
  return monthKeyOf(d);
}

export function monthKeyRange(monthKey: string): { from: Date; to: Date } {
  const [year, month] = monthKey.split("-").map(Number);
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1)); // exclusivo
  return { from, to };
}

export function bucketByMonth(transactions: BucketableTransaction[], monthKeys: string[]): MonthlyAmounts[] {
  const totals = new Map<string, { income: number; expenses: number }>();
  for (const key of monthKeys) totals.set(key, { income: 0, expenses: 0 });

  for (const tx of transactions) {
    const key = monthKeyOf(tx.date);
    const bucket = totals.get(key);
    if (!bucket) continue; // fuera del rango solicitado
    if (tx.isIncome) bucket.income += tx.amount;
    if (tx.isExpense) bucket.expenses += Math.abs(tx.amount);
  }

  return monthKeys.map((month) => {
    const { income, expenses } = totals.get(month)!;
    return {
      month,
      income: round2(income),
      expenses: round2(expenses),
      savings: round2(income - expenses),
      savingsRate: computeSavingsRate(income, expenses),
    };
  });
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function percentChange(current: number, reference: number): number | null {
  if (reference === 0) return null;
  return round2(((current - reference) / Math.abs(reference)) * 100);
}

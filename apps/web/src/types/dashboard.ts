// Tipado minimo: solo los campos que se usan ya. Se completara cuando se construya el
// dashboard real (ultimo bloque del frontend), reflejando DashboardService del backend.
export interface DashboardSummary {
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number | null;
}

export interface DashboardResponse {
  summary: DashboardSummary;
  netWorth: { netWorth: number };
}

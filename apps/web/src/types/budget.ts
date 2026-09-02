export interface Budget {
  id: string;
  userId: string;
  categoryId: string | null;
  amount: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string } | null;
}

export interface BudgetInput {
  categoryId?: string;
  amount: number;
}

export interface UpdateBudgetInput {
  amount?: number;
  isActive?: boolean;
}

export type BudgetAlertLevel = 70 | 80 | 90 | 100 | null;

export interface BudgetProgress {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  amount: number;
  spent: number;
  remaining: number;
  percentageConsumed: number;
  alertLevel: BudgetAlertLevel;
  projection: number | null;
}

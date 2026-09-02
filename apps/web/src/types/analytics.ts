export interface SummaryResult {
  month: string;
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number | null;
  previousMonth: {
    month: string;
    income: number;
    expenses: number;
    savings: number;
    savingsRate: number | null;
    incomeChangePercent: number | null;
    expensesChangePercent: number | null;
  };
  averageLastMonths: {
    months: number;
    income: number;
    expenses: number;
    expensesChangePercent: number | null;
  };
}

export interface MonthlyAmounts {
  month: string;
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number | null;
}

export interface CategoryBreakdownItem {
  categoryId: string | null;
  categoryName: string | null;
  total: number;
  transactionCount: number;
}

export interface MerchantBreakdownItem {
  merchantId: string | null;
  merchantName: string | null;
  total: number;
  transactionCount: number;
}

export interface NetWorthAccountItem {
  id: string;
  name: string;
  type: string;
  balance: number;
  isLiability: boolean;
}

export interface NetWorthResult {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  accounts: NetWorthAccountItem[];
}

export interface NetWorthEvolutionPoint {
  month: string;
  netWorth: number;
}

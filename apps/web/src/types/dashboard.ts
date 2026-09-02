import type { CategoryBreakdownItem, MonthlyAmounts, NetWorthEvolutionPoint, NetWorthResult, SummaryResult } from "./analytics";
import type { BudgetProgress } from "./budget";
import type { RecurringGroup } from "./recurring";
import type { SavingsGoal } from "./savings-goal";
import type { Transaction } from "./transaction";

export interface DashboardAlert {
  type: "budget" | "savings_goal" | "recurring_due";
  severity: "info" | "warning" | "critical";
  message: string;
}

export interface AvailableMoney {
  liquidBalance: number;
  pendingRecurringPayments: number;
  savingsGoalsMonthlyNeeded: number;
  availableMoney: number;
  dailyBudget: number | null;
}

export interface DashboardResponse {
  summary: SummaryResult;
  netWorth: NetWorthResult;
  netWorthEvolution: NetWorthEvolutionPoint[];
  monthlyEvolution: MonthlyAmounts[];
  byCategory: CategoryBreakdownItem[];
  topExpenses: Transaction[];
  budgetsProgress: BudgetProgress[];
  savingsGoals: SavingsGoal[];
  recurringGroups: RecurringGroup[];
  availableMoney: AvailableMoney;
  alerts: DashboardAlert[];
}

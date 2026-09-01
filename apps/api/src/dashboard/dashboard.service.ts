import { Injectable } from "@nestjs/common";
import { AnalyticsService } from "../analytics/analytics.service";
import { BudgetsService } from "../budgets/budgets.service";
import { SavingsGoalsService } from "../savings-goals/savings-goals.service";
import { RecurringService } from "../recurring/recurring.service";
import { monthKeyOf, monthKeyRange } from "../analytics/analytics-math";
import { computeAvailableMoney, computeDailyBudget, daysRemainingInMonth } from "./dashboard-math";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";

export interface DashboardAlert {
  type: "budget" | "savings_goal" | "recurring_due";
  severity: "info" | "warning" | "critical";
  message: string;
}

const RECURRING_DUE_SOON_DAYS = 3;

@Injectable()
export class DashboardService {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly budgetsService: BudgetsService,
    private readonly savingsGoalsService: SavingsGoalsService,
    private readonly recurringService: RecurringService,
  ) {}

  async getDashboard(userId: string, query: DashboardQueryDto) {
    const evolutionMonths = query.evolutionMonths ?? 12;
    const currentMonth = monthKeyOf(new Date());

    const [
      summary,
      netWorth,
      netWorthEvolution,
      monthlyEvolution,
      byCategory,
      topExpenses,
      liquidBalance,
      budgetsProgress,
      savingsGoals,
      recurringGroups,
    ] = await Promise.all([
      this.analyticsService.getSummary(userId, {}),
      this.analyticsService.getNetWorth(userId),
      this.analyticsService.getNetWorthEvolution(userId, evolutionMonths),
      this.analyticsService.getMonthlyEvolution(userId, { months: evolutionMonths }),
      this.analyticsService.getByCategory(userId, {}),
      this.analyticsService.getTopExpenses(userId, { limit: 5 }),
      this.analyticsService.getLiquidBalance(userId),
      this.budgetsService.getProgress(userId, {}),
      this.savingsGoalsService.findAll(userId),
      this.recurringService.findAll(userId, { isActive: true }),
    ]);

    const { to: monthEnd } = monthKeyRange(currentMonth);
    const today = new Date();

    // Pagos recurrentes que se esperan entre hoy y fin de mes, todavia no ocurridos.
    const pendingRecurringPayments = recurringGroups
      .filter((g) => g.nextEstimatedDate && g.nextEstimatedDate >= today && g.nextEstimatedDate < monthEnd)
      .reduce((sum, g) => sum + Math.abs(Number(g.typicalAmount)), 0);

    // Aportacion mensual necesaria de los objetivos activos que todavia no se ha apartado.
    const activeGoals = savingsGoals.filter((g) => g.status === "ACTIVE");
    const savingsGoalsMonthlyNeeded = activeGoals.reduce(
      (sum, g) => sum + Math.max(0, g.progress.monthlyContributionNeeded ?? 0),
      0,
    );

    const availableMoney = computeAvailableMoney({
      liquidBalance,
      pendingRecurringPayments,
      savingsGoalsMonthlyNeeded,
    });
    const dailyBudget = computeDailyBudget(availableMoney, daysRemainingInMonth(today));

    const alerts = this.buildAlerts(budgetsProgress, activeGoals, recurringGroups, today);

    return {
      summary,
      netWorth,
      netWorthEvolution,
      monthlyEvolution,
      byCategory,
      topExpenses,
      budgetsProgress,
      savingsGoals,
      recurringGroups,
      availableMoney: {
        liquidBalance,
        pendingRecurringPayments: Math.round(pendingRecurringPayments * 100) / 100,
        savingsGoalsMonthlyNeeded: Math.round(savingsGoalsMonthlyNeeded * 100) / 100,
        availableMoney,
        dailyBudget,
      },
      alerts,
    };
  }

  private buildAlerts(
    budgetsProgress: Awaited<ReturnType<BudgetsService["getProgress"]>>,
    activeGoals: Awaited<ReturnType<SavingsGoalsService["findAll"]>>,
    recurringGroups: Awaited<ReturnType<RecurringService["findAll"]>>,
    today: Date,
  ): DashboardAlert[] {
    const alerts: DashboardAlert[] = [];

    for (const budget of budgetsProgress) {
      if (budget.alertLevel === null) continue;
      alerts.push({
        type: "budget",
        severity: budget.alertLevel >= 100 ? "critical" : budget.alertLevel >= 90 ? "warning" : "info",
        message: `Presupuesto de ${budget.categoryName ?? "general"}: ${budget.percentageConsumed}% consumido (${budget.spent}€ de ${budget.amount}€)`,
      });
    }

    for (const goal of activeGoals) {
      if (goal.progress.isOnTrack) continue;
      alerts.push({
        type: "savings_goal",
        severity: "warning",
        message: `Objetivo "${goal.name}": vas por detrás del ritmo necesario (desviación de ${goal.progress.deviation}€)`,
      });
    }

    const dueSoonLimit = new Date(today.getTime() + RECURRING_DUE_SOON_DAYS * 24 * 60 * 60 * 1000);
    for (const group of recurringGroups) {
      if (!group.nextEstimatedDate) continue;
      if (group.nextEstimatedDate < today || group.nextEstimatedDate > dueSoonLimit) continue;
      alerts.push({
        type: "recurring_due",
        severity: "info",
        message: `${group.description}: pago recurrente previsto en los próximos ${RECURRING_DUE_SOON_DAYS} días (~${Math.abs(Number(group.typicalAmount))}€)`,
      });
    }

    return alerts;
  }
}

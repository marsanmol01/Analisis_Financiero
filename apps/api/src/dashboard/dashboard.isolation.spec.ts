// Test de integracion real. Reproduce el ejemplo del enunciado de "dinero realmente disponible"
// (saldo 5.000 - pagos recurrentes pendientes 840 - objetivo de ahorro 1.000 = 3.160) y verifica
// aislamiento entre usuarios en el endpoint agregador.
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../../../../.env") });

import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { AccountsService } from "../accounts/accounts.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { BudgetsService } from "../budgets/budgets.service";
import { SavingsGoalsService } from "../savings-goals/savings-goals.service";
import { RecurringService } from "../recurring/recurring.service";
import { DashboardService } from "./dashboard.service";
import { monthKeyOf, monthKeyRange } from "../analytics/analytics-math";

describe("DashboardService (integracion real: dinero disponible, aislamiento)", () => {
  let prisma: PrismaService;
  let accountsService: AccountsService;
  let service: DashboardService;
  let userA: { id: string };
  let userB: { id: string };
  let checkingAccount: { id: string };
  let counter = 0;

  beforeAll(async () => {
    const config = { getOrThrow: (key: string) => process.env[key] } as unknown as ConfigService;
    prisma = new PrismaService(config);
    await prisma.onModuleInit();
    accountsService = new AccountsService(prisma);
    const analyticsService = new AnalyticsService(prisma);
    const budgetsService = new BudgetsService(prisma);
    const savingsGoalsService = new SavingsGoalsService(prisma);
    const recurringService = new RecurringService(prisma);
    service = new DashboardService(analyticsService, budgetsService, savingsGoalsService, recurringService);

    const passwordHash = await argon2.hash("not-used-in-this-test", { type: argon2.argon2id });
    const suffix = Date.now();
    userA = await prisma.user.create({ data: { email: `dashboard-a-${suffix}@example.test`, passwordHash } });
    userB = await prisma.user.create({ data: { email: `dashboard-b-${suffix}@example.test`, passwordHash } });

    checkingAccount = await accountsService.create(userA.id, {
      name: "Cuenta corriente",
      type: "CHECKING",
      currency: "EUR",
      balance: 5000,
    });
  });

  afterAll(async () => {
    await prisma.recurringGroup.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.savingsGoal.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.budget.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.balanceSnapshot.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.transaction.deleteMany({ where: { account: { userId: { in: [userA.id, userB.id] } } } });
    await prisma.account.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.onModuleDestroy();
  });

  it("reproduce el ejemplo del enunciado: 5.000 - 840 (recurrente pendiente) - 1.000 (objetivo) = 3.160", async () => {
    // Un gasto recurrente de 840 con proxima fecha estimada mas tarde este mismo mes.
    counter++;
    const anchorTx = await prisma.transaction.create({
      data: {
        accountId: checkingAccount.id,
        date: new Date(),
        originalDescription: "SEGURO ANUAL",
        normalizedDescription: "SEGURO ANUAL",
        amount: -840,
        isExpense: true,
        fingerprint: `fp-dashboard-${counter}-${Date.now()}`,
      },
    });
    const inMonthEnd = monthKeyRange(monthKeyOf(new Date())).to;
    const soon = new Date(Math.min(Date.now() + 2 * 24 * 60 * 60 * 1000, inMonthEnd.getTime() - 1));
    await prisma.recurringGroup.create({
      data: {
        userId: userA.id,
        accountId: checkingAccount.id,
        description: "SEGURO ANUAL",
        frequency: "ANNUAL",
        typicalAmount: -840,
        lastDate: anchorTx.date,
        nextEstimatedDate: soon,
        isManual: true,
      },
    });

    // Un objetivo activo que necesita ~1.000/mes para llegar a tiempo.
    await prisma.savingsGoal.create({
      data: {
        userId: userA.id,
        name: "Objetivo con aportacion de 1000",
        targetAmount: 1000,
        initialAmount: 0,
        currentAmount: 0,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // ~1 mes vista
      },
    });

    const dashboard = await service.getDashboard(userA.id, {});

    expect(dashboard.availableMoney.liquidBalance).toBe(5000);
    expect(dashboard.availableMoney.pendingRecurringPayments).toBeCloseTo(840, 0);
    // La aportacion mensual necesaria usa el mes "medio" de savings-goal-math.ts (365.25/12
    // dias), igual que en savings-goal-math.spec.ts: con una fecha limite a "30 dias vista" el
    // resultado no es exactamente 1000/mes, sino cercano. Tolerancia amplia deliberada.
    expect(dashboard.availableMoney.savingsGoalsMonthlyNeeded).toBeGreaterThan(950);
    expect(dashboard.availableMoney.savingsGoalsMonthlyNeeded).toBeLessThan(1050);
    expect(dashboard.availableMoney.availableMoney).toBeGreaterThan(3110);
    expect(dashboard.availableMoney.availableMoney).toBeLessThan(3210);
    expect(dashboard.availableMoney.dailyBudget).not.toBeNull();
  });

  it("genera una alerta de presupuesto cuando se supera un umbral", async () => {
    const category = await prisma.category.findFirst({ where: { isSystem: true } });
    await prisma.budget.create({ data: { userId: userA.id, categoryId: category!.id, amount: 100 } });
    await prisma.transaction.create({
      data: {
        accountId: checkingAccount.id,
        date: new Date(),
        originalDescription: "GASTO PARA DISPARAR ALERTA",
        normalizedDescription: "GASTO PARA DISPARAR ALERTA",
        amount: -95,
        isExpense: true,
        categoryId: category!.id,
        fingerprint: `fp-dashboard-alert-${Date.now()}`,
      },
    });

    const dashboard = await service.getDashboard(userA.id, {});
    expect(dashboard.alerts.some((a) => a.type === "budget")).toBe(true);
  });

  it("el dashboard de un usuario no incluye datos de otro usuario", async () => {
    await accountsService.create(userB.id, {
      name: "Cuenta gigante de B",
      type: "CHECKING",
      currency: "EUR",
      balance: 999999,
    });

    const dashboardA = await service.getDashboard(userA.id, {});
    expect(dashboardA.availableMoney.liquidBalance).toBeLessThan(999999);
    expect(dashboardA.netWorth.accounts.find((a) => a.name === "Cuenta gigante de B")).toBeUndefined();
  });
});

import { Injectable } from "@nestjs/common";
import { AccountType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  bucketByMonth,
  BucketableTransaction,
  computeSavingsRate,
  lastMonthKeys,
  MonthlyAmounts,
  monthKeyOf,
  monthKeyRange,
  percentChange,
  previousMonthKey,
  round2,
} from "./analytics-math";
import { buildPayCycles, daysBetween } from "./pay-cycle";
import { SummaryQueryDto } from "./dto/summary-query.dto";
import { MonthlyEvolutionQueryDto } from "./dto/monthly-evolution-query.dto";
import { BreakdownQueryDto } from "./dto/breakdown-query.dto";
import { TopExpensesQueryDto } from "./dto/top-expenses-query.dto";
import { PayCycleQueryDto } from "./dto/pay-cycle-query.dto";

const NOMINA_CATEGORY_NAME = "Nómina";
const PAGA_EXTRA_CATEGORY_NAME = "Paga extra";

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

export interface NetWorthResult {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  accounts: { id: string; name: string; type: string; balance: number; isLiability: boolean }[];
}

export interface NetWorthEvolutionPoint {
  month: string;
  netWorth: number;
}

export interface PayCyclePeriod {
  startDate: string;
  endDate: string;
  isOpen: boolean;
  daysElapsed: number;
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number | null;
  salaryIncome: number;
  extraIncome: number;
  byCategory: CategoryBreakdownItem[];
}

export interface PayCycleSummaryResult {
  hasSalaryData: boolean;
  current: PayCyclePeriod | null;
  previous: PayCyclePeriod | null;
  average: { cycles: number; income: number; expenses: number; savingsRate: number | null } | null;
}

// Tipos de cuenta que se consideran dinero de uso inmediato para "dinero realmente disponible".
// Decision explicita: INVESTMENT y DEPOSIT quedan fuera (no son liquidos al instante, suelen
// tener plazo o penalizacion por retirada anticipada) y LOAN tambien (es deuda, no disponible).
const LIQUID_ACCOUNT_TYPES: AccountType[] = ["CHECKING", "SAVINGS", "CASH", "DIGITAL", "CARD"];

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // Todas las agregaciones de ingresos/gastos excluyen SIEMPRE isInternalTransfer: true — una
  // transferencia entre cuentas propias no debe sumar como ingreso ni como gasto.
  private async fetchBucketable(
    userId: string,
    from: Date,
    to: Date,
    accountId?: string,
  ): Promise<BucketableTransaction[]> {
    const rows = await this.prisma.transaction.findMany({
      where: {
        deletedAt: null,
        isInternalTransfer: false,
        date: { gte: from, lt: to },
        account: { userId, ...(accountId ? { id: accountId } : {}) },
      },
      select: { date: true, amount: true, isIncome: true, isExpense: true },
    });
    return rows.map((r) => ({ date: r.date, amount: Number(r.amount), isIncome: r.isIncome, isExpense: r.isExpense }));
  }

  async getSummary(userId: string, query: SummaryQueryDto): Promise<SummaryResult> {
    const month = query.month ?? monthKeyOf(new Date());
    const compareMonths = query.compareMonths ?? 6;
    const prevKey = previousMonthKey(month);
    const avgKeys = lastMonthKeys(compareMonths, prevKey);
    const allMonthKeys = [...avgKeys, month]; // avgKeys ya termina en prevKey y va cronologicamente ascendente

    const rangeFrom = monthKeyRange(allMonthKeys[0]).from;
    const rangeTo = monthKeyRange(month).to;
    const rows = await this.fetchBucketable(userId, rangeFrom, rangeTo, query.accountId);
    const buckets = bucketByMonth(rows, allMonthKeys);
    const byMonth = new Map(buckets.map((b) => [b.month, b]));

    const current = byMonth.get(month)!;
    const previous = byMonth.get(prevKey)!;
    const avgBuckets = buckets.filter((b) => avgKeys.includes(b.month));
    const avgIncome = round2(avgBuckets.reduce((sum, b) => sum + b.income, 0) / avgBuckets.length);
    const avgExpenses = round2(avgBuckets.reduce((sum, b) => sum + b.expenses, 0) / avgBuckets.length);

    return {
      ...current,
      previousMonth: {
        ...previous,
        incomeChangePercent: percentChange(current.income, previous.income),
        expensesChangePercent: percentChange(current.expenses, previous.expenses),
      },
      averageLastMonths: {
        months: compareMonths,
        income: avgIncome,
        expenses: avgExpenses,
        expensesChangePercent: percentChange(current.expenses, avgExpenses),
      },
    };
  }

  async getMonthlyEvolution(userId: string, query: MonthlyEvolutionQueryDto): Promise<MonthlyAmounts[]> {
    const months = query.months ?? 12;
    const referenceMonth = query.month ?? monthKeyOf(new Date());
    const monthKeys = lastMonthKeys(months, referenceMonth);

    const from = monthKeyRange(monthKeys[0]).from;
    const to = monthKeyRange(referenceMonth).to;
    const rows = await this.fetchBucketable(userId, from, to, query.accountId);
    return bucketByMonth(rows, monthKeys);
  }

  async getByCategory(userId: string, query: BreakdownQueryDto): Promise<CategoryBreakdownItem[]> {
    const { from, to } = this.resolveRange(query);
    return this.groupByCategory(userId, from, to, query.accountId);
  }

  // Extraido de getByCategory para reutilizarlo con rangos exactos ya resueltos (p.ej. los
  // limites de un ciclo de nomina), sin repetir el ajuste de "hasta, inclusivo -> +1 dia" que
  // solo tiene sentido para el rango que llega desde una peticion HTTP.
  private async groupByCategory(
    userId: string,
    from: Date,
    to: Date,
    accountId?: string,
  ): Promise<CategoryBreakdownItem[]> {
    const grouped = await this.prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        deletedAt: null,
        isInternalTransfer: false,
        isExpense: true,
        date: { gte: from, lt: to },
        account: { userId, ...(accountId ? { id: accountId } : {}) },
      },
      _sum: { amount: true },
      _count: true,
    });

    const categoryIds = grouped.map((g) => g.categoryId).filter((id): id is string => id !== null);
    const categories = await this.prisma.category.findMany({ where: { id: { in: categoryIds } } });
    const namesById = new Map(categories.map((c) => [c.id, c.name]));

    return grouped
      .map((g) => ({
        categoryId: g.categoryId,
        categoryName: g.categoryId ? (namesById.get(g.categoryId) ?? null) : null,
        total: round2(Math.abs(Number(g._sum.amount ?? 0))),
        transactionCount: g._count,
      }))
      .sort((a, b) => b.total - a.total);
  }

  async getByMerchant(userId: string, query: BreakdownQueryDto): Promise<MerchantBreakdownItem[]> {
    const { from, to } = this.resolveRange(query);

    const grouped = await this.prisma.transaction.groupBy({
      by: ["merchantId"],
      where: {
        deletedAt: null,
        isInternalTransfer: false,
        isExpense: true,
        date: { gte: from, lt: to },
        account: { userId, ...(query.accountId ? { id: query.accountId } : {}) },
      },
      _sum: { amount: true },
      _count: true,
    });

    const merchantIds = grouped.map((g) => g.merchantId).filter((id): id is string => id !== null);
    const merchants = await this.prisma.merchant.findMany({ where: { id: { in: merchantIds } } });
    const namesById = new Map(merchants.map((m) => [m.id, m.name]));

    return grouped
      .map((g) => ({
        merchantId: g.merchantId,
        merchantName: g.merchantId ? (namesById.get(g.merchantId) ?? null) : null,
        total: round2(Math.abs(Number(g._sum.amount ?? 0))),
        transactionCount: g._count,
      }))
      .sort((a, b) => b.total - a.total);
  }

  async getTopExpenses(userId: string, query: TopExpensesQueryDto) {
    const { from, to } = this.resolveRange(query);
    const limit = query.limit ?? 10;

    return this.prisma.transaction.findMany({
      where: {
        deletedAt: null,
        isInternalTransfer: false,
        isExpense: true,
        date: { gte: from, lt: to },
        account: { userId, ...(query.accountId ? { id: query.accountId } : {}) },
      },
      orderBy: { amount: "asc" }, // los gastos son negativos: el mas negativo es el mayor gasto
      take: limit,
    });
  }

  async getNetWorth(userId: string): Promise<NetWorthResult> {
    const accounts = await this.prisma.account.findMany({
      where: { userId, deletedAt: null, isActive: true },
      select: { id: true, name: true, type: true, balance: true },
    });

    const mapped = accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: round2(Number(a.balance)),
      isLiability: a.type === "LOAN",
    }));

    const totalAssets = round2(mapped.filter((a) => !a.isLiability).reduce((sum, a) => sum + a.balance, 0));
    const totalLiabilities = round2(mapped.filter((a) => a.isLiability).reduce((sum, a) => sum + a.balance, 0));

    return {
      netWorth: round2(totalAssets + totalLiabilities),
      totalAssets,
      totalLiabilities,
      accounts: mapped,
    };
  }

  async getLiquidBalance(userId: string): Promise<number> {
    const accounts = await this.prisma.account.findMany({
      where: { userId, deletedAt: null, isActive: true, type: { in: LIQUID_ACCOUNT_TYPES } },
      select: { balance: true },
    });
    return round2(accounts.reduce((sum, a) => sum + Number(a.balance), 0));
  }

  // Evolucion mensual del patrimonio a partir de BalanceSnapshot: para cada mes solicitado, se
  // toma la ultima foto de cada cuenta anterior al fin de ese mes y se suman. Si una cuenta
  // todavia no tenia ninguna foto en ese momento (se creo despues), no aporta nada ese mes — no
  // se inventa un valor hacia atras.
  async getNetWorthEvolution(userId: string, months: number): Promise<NetWorthEvolutionPoint[]> {
    const referenceMonth = monthKeyOf(new Date());
    const monthKeys = lastMonthKeys(months, referenceMonth);
    const rangeEnd = monthKeyRange(referenceMonth).to;

    const snapshots = await this.prisma.balanceSnapshot.findMany({
      where: { userId, date: { lt: rangeEnd } },
      select: { accountId: true, balance: true, date: true },
      orderBy: { date: "asc" },
    });

    return monthKeys.map((month) => {
      const { to } = monthKeyRange(month);
      const latestByAccount = new Map<string, number>();
      for (const snap of snapshots) {
        if (snap.date >= to) break; // snapshots vienen ordenadas asc: a partir de aqui son futuras a este mes
        latestByAccount.set(snap.accountId, Number(snap.balance));
      }
      const netWorth = round2([...latestByAccount.values()].reduce((sum, b) => sum + b, 0));
      return { month, netWorth };
    });
  }

  // "Ciclo de nomina": en vez de mes de calendario, el periodo va desde que se cobra la nomina
  // hasta que se cobra la siguiente. Una paga extra cuenta como ingreso del ciclo en el que cae,
  // pero nunca abre un ciclo nuevo — solo un ingreso categorizado como "Nomina" lo hace.
  async getPayCycleSummary(userId: string, query: PayCycleQueryDto): Promise<PayCycleSummaryResult> {
    const compareCycles = query.compareCycles ?? 6;
    const nominaCategoryId = await this.findCategoryIdByName(NOMINA_CATEGORY_NAME);
    if (!nominaCategoryId) {
      return { hasSalaryData: false, current: null, previous: null, average: null };
    }

    const nominaTransactions = await this.prisma.transaction.findMany({
      where: { deletedAt: null, isIncome: true, categoryId: nominaCategoryId, account: { userId } },
      select: { date: true },
      orderBy: { date: "asc" },
    });
    if (nominaTransactions.length === 0) {
      return { hasSalaryData: false, current: null, previous: null, average: null };
    }

    const pagaExtraCategoryId = await this.findCategoryIdByName(PAGA_EXTRA_CATEGORY_NAME);
    const cycles = buildPayCycles(nominaTransactions.map((t) => t.date), new Date());

    const currentBounds = cycles[cycles.length - 1];
    const previousBounds = cycles.length >= 2 ? cycles[cycles.length - 2] : undefined;
    const compareBounds = cycles.slice(Math.max(0, cycles.length - 1 - compareCycles), cycles.length - 1);

    const [current, previous, comparePeriods] = await Promise.all([
      this.buildCyclePeriod(userId, currentBounds, nominaCategoryId, pagaExtraCategoryId),
      previousBounds
        ? this.buildCyclePeriod(userId, previousBounds, nominaCategoryId, pagaExtraCategoryId)
        : Promise.resolve(null),
      Promise.all(compareBounds.map((b) => this.buildCyclePeriod(userId, b, nominaCategoryId, pagaExtraCategoryId))),
    ]);

    const average =
      comparePeriods.length > 0
        ? {
            cycles: comparePeriods.length,
            income: round2(comparePeriods.reduce((sum, p) => sum + p.income, 0) / comparePeriods.length),
            expenses: round2(comparePeriods.reduce((sum, p) => sum + p.expenses, 0) / comparePeriods.length),
            savingsRate: computeSavingsRate(
              comparePeriods.reduce((sum, p) => sum + p.income, 0) / comparePeriods.length,
              comparePeriods.reduce((sum, p) => sum + p.expenses, 0) / comparePeriods.length,
            ),
          }
        : null;

    return { hasSalaryData: true, current, previous, average };
  }

  private async buildCyclePeriod(
    userId: string,
    bounds: { start: Date; end: Date; isOpen: boolean },
    nominaCategoryId: string,
    pagaExtraCategoryId: string | null,
  ): Promise<PayCyclePeriod> {
    const rows = await this.prisma.transaction.findMany({
      where: {
        deletedAt: null,
        isInternalTransfer: false,
        date: { gte: bounds.start, lt: bounds.end },
        account: { userId },
      },
      select: { amount: true, isIncome: true, isExpense: true, categoryId: true },
    });

    let income = 0;
    let expenses = 0;
    let salaryIncome = 0;
    let extraIncome = 0;
    for (const row of rows) {
      const amount = Number(row.amount);
      if (row.isIncome) {
        income += amount;
        if (row.categoryId === nominaCategoryId) salaryIncome += amount;
        else if (pagaExtraCategoryId && row.categoryId === pagaExtraCategoryId) extraIncome += amount;
      }
      if (row.isExpense) expenses += Math.abs(amount);
    }

    const byCategory = await this.groupByCategory(userId, bounds.start, bounds.end);

    return {
      startDate: bounds.start.toISOString(),
      endDate: bounds.end.toISOString(),
      isOpen: bounds.isOpen,
      daysElapsed: daysBetween(bounds.start, bounds.end),
      income: round2(income),
      expenses: round2(expenses),
      savings: round2(income - expenses),
      savingsRate: computeSavingsRate(income, expenses),
      salaryIncome: round2(salaryIncome),
      extraIncome: round2(extraIncome),
      byCategory,
    };
  }

  private async findCategoryIdByName(name: string): Promise<string | null> {
    const category = await this.prisma.category.findFirst({ where: { name, isSystem: true } });
    return category?.id ?? null;
  }

  private resolveRange(query: { from?: string; to?: string }): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
    // "to" es inclusivo en la peticion del usuario; internamente usamos limite exclusivo.
    const toExclusive = new Date(to.getTime() + 24 * 60 * 60 * 1000);
    return { from, to: toExclusive };
  }
}

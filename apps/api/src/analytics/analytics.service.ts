import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  bucketByMonth,
  BucketableTransaction,
  lastMonthKeys,
  MonthlyAmounts,
  monthKeyOf,
  monthKeyRange,
  percentChange,
  previousMonthKey,
  round2,
} from "./analytics-math";
import { SummaryQueryDto } from "./dto/summary-query.dto";
import { MonthlyEvolutionQueryDto } from "./dto/monthly-evolution-query.dto";
import { BreakdownQueryDto } from "./dto/breakdown-query.dto";
import { TopExpensesQueryDto } from "./dto/top-expenses-query.dto";

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

    const grouped = await this.prisma.transaction.groupBy({
      by: ["categoryId"],
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

  private resolveRange(query: { from?: string; to?: string }): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
    // "to" es inclusivo en la peticion del usuario; internamente usamos limite exclusivo.
    const toExclusive = new Date(to.getTime() + 24 * 60 * 60 * 1000);
    return { from, to: toExclusive };
  }
}

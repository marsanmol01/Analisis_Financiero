import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Budget } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { monthKeyOf, monthKeyRange } from "../analytics/analytics-math";
import { computeAlertLevel, computePercentageConsumed, daysInMonth, projectToMonthEnd, round2 } from "./budget-math";
import { CreateBudgetDto } from "./dto/create-budget.dto";
import { UpdateBudgetDto } from "./dto/update-budget.dto";
import { ProgressQueryDto } from "./dto/progress-query.dto";

export interface BudgetProgress {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  amount: number;
  spent: number;
  remaining: number;
  percentageConsumed: number;
  alertLevel: 70 | 80 | 90 | 100 | null;
  projection: number | null;
}

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.budget.findMany({
      where: { userId },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async findOne(userId: string, id: string): Promise<Budget> {
    const budget = await this.prisma.budget.findFirst({ where: { id, userId } });
    if (!budget) {
      throw new NotFoundException("Presupuesto no encontrado");
    }
    return budget;
  }

  async create(userId: string, dto: CreateBudgetDto): Promise<Budget> {
    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, OR: [{ isSystem: true }, { userId }] },
      });
      if (!category) {
        throw new BadRequestException("La categoría indicada no existe o no es accesible");
      }
    }

    // El @@unique del esquema no atrapa el caso categoryId=NULL (presupuesto general); se
    // comprueba aqui explicitamente para cubrir ambos casos por igual.
    const existing = await this.prisma.budget.findFirst({
      where: { userId, categoryId: dto.categoryId ?? null },
    });
    if (existing) {
      throw new ConflictException(
        dto.categoryId
          ? "Ya existe un presupuesto para esa categoría"
          : "Ya existe un presupuesto general",
      );
    }

    return this.prisma.budget.create({
      data: { userId, categoryId: dto.categoryId, amount: dto.amount },
    });
  }

  async update(userId: string, id: string, dto: UpdateBudgetDto): Promise<Budget> {
    await this.findOne(userId, id);
    return this.prisma.budget.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);
    await this.prisma.budget.delete({ where: { id } });
  }

  async getProgress(userId: string, query: ProgressQueryDto): Promise<BudgetProgress[]> {
    const month = query.month ?? monthKeyOf(new Date());
    const { from, to } = monthKeyRange(month);
    const isCurrentMonth = month === monthKeyOf(new Date());
    const dayOfMonth = isCurrentMonth ? new Date().getUTCDate() : 0;
    const totalDays = daysInMonth(month);

    const budgets = await this.prisma.budget.findMany({
      where: { userId, isActive: true },
      include: { category: { select: { name: true } } },
    });

    const results: BudgetProgress[] = [];
    for (const budget of budgets) {
      // Presupuesto general (categoryId null) = todo el gasto del periodo; por categoria, solo
      // el gasto de esa categoria. Misma exclusion de transferencias internas que en Analytics.
      const aggregate = await this.prisma.transaction.aggregate({
        where: {
          deletedAt: null,
          isInternalTransfer: false,
          isExpense: true,
          date: { gte: from, lt: to },
          account: { userId },
          ...(budget.categoryId ? { categoryId: budget.categoryId } : {}),
        },
        _sum: { amount: true },
      });

      const spent = round2(Math.abs(Number(aggregate._sum.amount ?? 0)));
      const amount = Number(budget.amount);
      const percentageConsumed = computePercentageConsumed(spent, amount);

      results.push({
        id: budget.id,
        categoryId: budget.categoryId,
        categoryName: budget.category?.name ?? null,
        amount,
        spent,
        remaining: round2(amount - spent),
        percentageConsumed,
        alertLevel: computeAlertLevel(percentageConsumed),
        projection: isCurrentMonth ? projectToMonthEnd(spent, dayOfMonth, totalDays) : null,
      });
    }

    return results;
  }
}

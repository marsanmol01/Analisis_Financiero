import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { SavingsGoal } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { computeGoalProgress, GoalProgress } from "./savings-goal-math";
import { CreateSavingsGoalDto } from "./dto/create-savings-goal.dto";
import { UpdateSavingsGoalDto } from "./dto/update-savings-goal.dto";

export type SavingsGoalWithProgress = SavingsGoal & { progress: GoalProgress };

const includeAccountBalance = { account: { select: { balance: true } } } as const;

@Injectable()
export class SavingsGoalsService {
  constructor(private readonly prisma: PrismaService) {}

  private withProgress(goal: SavingsGoal & { account?: { balance: unknown } | null }): SavingsGoalWithProgress {
    const currentAmount = goal.accountId && goal.account ? Number(goal.account.balance) : Number(goal.currentAmount);
    const progress = computeGoalProgress({
      targetAmount: Number(goal.targetAmount),
      initialAmount: Number(goal.initialAmount),
      currentAmount,
      startDate: goal.startDate,
      targetDate: goal.targetDate,
      today: new Date(),
    });
    // No se reexpone el balance de la cuenta vinculada como tal (ya esta reflejado en
    // progress.savedSoFar/remainingAmount); basta con no incluir "account" en la respuesta.
    return {
      id: goal.id,
      userId: goal.userId,
      accountId: goal.accountId,
      name: goal.name,
      targetAmount: goal.targetAmount,
      initialAmount: goal.initialAmount,
      currentAmount: goal.currentAmount,
      startDate: goal.startDate,
      targetDate: goal.targetDate,
      status: goal.status,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      progress,
    };
  }

  async findAll(userId: string): Promise<SavingsGoalWithProgress[]> {
    const goals = await this.prisma.savingsGoal.findMany({
      where: { userId },
      include: includeAccountBalance,
      orderBy: { targetDate: "asc" },
    });
    return goals.map((g) => this.withProgress(g));
  }

  async findOne(userId: string, id: string): Promise<SavingsGoalWithProgress> {
    const goal = await this.prisma.savingsGoal.findFirst({
      where: { id, userId },
      include: includeAccountBalance,
    });
    if (!goal) {
      throw new NotFoundException("Objetivo de ahorro no encontrado");
    }
    return this.withProgress(goal);
  }

  private async assertAccountAccessible(userId: string, accountId: string): Promise<void> {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId, deletedAt: null } });
    if (!account) {
      throw new BadRequestException("La cuenta indicada no existe o no es accesible");
    }
  }

  async create(userId: string, dto: CreateSavingsGoalDto): Promise<SavingsGoalWithProgress> {
    const initialAmount = dto.initialAmount ?? 0;
    if (dto.targetAmount <= initialAmount) {
      throw new BadRequestException("El importe objetivo debe ser mayor que el importe inicial");
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const targetDate = new Date(dto.targetDate);
    if (targetDate <= startDate) {
      throw new BadRequestException("La fecha límite debe ser posterior a la fecha inicial");
    }

    if (dto.accountId) {
      await this.assertAccountAccessible(userId, dto.accountId);
    }

    const goal = await this.prisma.savingsGoal.create({
      data: {
        userId,
        name: dto.name,
        targetAmount: dto.targetAmount,
        initialAmount,
        currentAmount: initialAmount,
        startDate,
        targetDate,
        accountId: dto.accountId,
      },
      include: includeAccountBalance,
    });
    return this.withProgress(goal);
  }

  async update(userId: string, id: string, dto: UpdateSavingsGoalDto): Promise<SavingsGoalWithProgress> {
    const existing = await this.prisma.savingsGoal.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new NotFoundException("Objetivo de ahorro no encontrado");
    }

    const resultingAccountId = dto.accountId !== undefined ? dto.accountId : existing.accountId;

    if (dto.currentAmount !== undefined && resultingAccountId) {
      throw new BadRequestException(
        "No se puede fijar el importe actual a mano en un objetivo vinculado a una cuenta: el progreso lo marca el saldo de la cuenta",
      );
    }
    if (dto.accountId) {
      await this.assertAccountAccessible(userId, dto.accountId);
    }

    const targetAmount = dto.targetAmount ?? Number(existing.targetAmount);
    if (targetAmount <= Number(existing.initialAmount)) {
      throw new BadRequestException("El importe objetivo debe ser mayor que el importe inicial");
    }

    const targetDate = dto.targetDate ? new Date(dto.targetDate) : existing.targetDate;
    if (targetDate <= existing.startDate) {
      throw new BadRequestException("La fecha límite debe ser posterior a la fecha inicial");
    }

    const goal = await this.prisma.savingsGoal.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.targetAmount !== undefined && { targetAmount: dto.targetAmount }),
        ...(dto.targetDate !== undefined && { targetDate }),
        ...(dto.accountId !== undefined && { accountId: dto.accountId }),
        ...(dto.currentAmount !== undefined && { currentAmount: dto.currentAmount }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: includeAccountBalance,
    });
    return this.withProgress(goal);
  }

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.prisma.savingsGoal.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new NotFoundException("Objetivo de ahorro no encontrado");
    }
    await this.prisma.savingsGoal.delete({ where: { id } });
  }
}

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ClassificationRule, Transaction } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ClassificationRulesService } from "../classification-rules/classification-rules.service";
import { ListTransactionsQueryDto } from "./dto/list-transactions.query.dto";
import { UpdateTransactionDto } from "./dto/update-transaction.dto";

const DEFAULT_PAGE_SIZE = 50;

export interface UpdateTransactionResult {
  transaction: Transaction;
  similarUpdatedCount?: number;
  ruleCreated?: ClassificationRule;
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rulesService: ClassificationRulesService,
  ) {}

  async findAll(userId: string, query: ListTransactionsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    // El aislamiento aqui pasa por la cuenta: solo se listan transacciones de cuentas del
    // usuario autenticado (nunca se filtra solo por accountId sin comprobar el dueño).
    const where = {
      deletedAt: null,
      account: { userId, ...(query.accountId ? { id: query.accountId } : {}) },
      ...((query.from || query.to) && {
        date: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lte: new Date(query.to) }),
        },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(userId: string, id: string): Promise<Transaction> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, deletedAt: null, account: { userId } },
    });
    if (!transaction) {
      throw new NotFoundException("Transacción no encontrada");
    }
    return transaction;
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto, ip?: string): Promise<UpdateTransactionResult> {
    const existing = await this.findOne(userId, id);

    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, OR: [{ isSystem: true }, { userId }] },
      });
      if (!category) {
        throw new BadRequestException("La categoría indicada no existe o no es accesible");
      }
    }

    const transaction = await this.prisma.transaction.update({
      where: { id },
      data: {
        ...(dto.categoryId !== undefined && {
          categoryId: dto.categoryId,
          classificationSource: dto.categoryId ? "manual" : null,
          confidence: dto.categoryId ? 1 : null,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    const result: UpdateTransactionResult = { transaction };

    // Las dos opciones de "enseñar al sistema" solo tienen sentido cuando se esta fijando una
    // categoria concreta (no al vaciarla) y sobre una correccion manual real.
    if (dto.categoryId && dto.applyToSimilar) {
      const description = existing.normalizedDescription;
      if (description) {
        const { count } = await this.prisma.transaction.updateMany({
          where: {
            id: { not: id },
            deletedAt: null,
            normalizedDescription: description,
            account: { userId },
            OR: [{ classificationSource: null }, { classificationSource: { not: "manual" } }],
          },
          data: { categoryId: dto.categoryId, classificationSource: "manual", confidence: 1 },
        });
        result.similarUpdatedCount = count;
      } else {
        result.similarUpdatedCount = 0;
      }
    }

    if (dto.categoryId && dto.createRule && existing.normalizedDescription) {
      result.ruleCreated = await this.rulesService.create(
        userId,
        { operator: "CONTAINS", value: existing.normalizedDescription, categoryId: dto.categoryId },
        { ip, createdVia: "correction" },
      );
    }

    return result;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);
    await this.prisma.transaction.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}

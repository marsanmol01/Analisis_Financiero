import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { RecurringGroup } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  detectRecurringPattern,
  monthlyEquivalent,
  RecurringCandidateTransaction,
} from "./recurring-detector";
import { DetectRecurringDto } from "./dto/detect-recurring.dto";
import { ManualRecurringDto } from "./dto/manual-recurring.dto";
import { UpdateRecurringDto } from "./dto/update-recurring.dto";
import { ListRecurringQueryDto } from "./dto/list-recurring.query.dto";

export interface RecurringGroupWithEstimates extends RecurringGroup {
  monthlyEquivalent: number;
  annualEstimate: number;
}

export interface DetectRecurringResult {
  groupsCreated: number;
  groupsUpdated: number;
  transactionsLinked: number;
}

function withEstimates(group: RecurringGroup): RecurringGroupWithEstimates {
  const monthly = monthlyEquivalent(Number(group.typicalAmount), group.frequency);
  return { ...group, monthlyEquivalent: Math.round(monthly * 100) / 100, annualEstimate: Math.round(monthly * 12 * 100) / 100 };
}

@Injectable()
export class RecurringService {
  constructor(private readonly prisma: PrismaService) {}

  async detect(userId: string, dto: DetectRecurringDto): Promise<DetectRecurringResult> {
    // Solo se agrupan/actualizan automaticamente transacciones que no pertenezcan ya a un grupo
    // MANUAL: una vez el usuario ha curado un grupo a mano, el detector nunca lo toca ni le
    // arrebata transacciones para formar un grupo competidor con la misma clave.
    const rows = await this.prisma.transaction.findMany({
      where: {
        deletedAt: null,
        amount: { lt: 0 },
        isInternalTransfer: false,
        account: { userId, ...(dto.accountId ? { id: dto.accountId } : {}) },
        OR: [{ recurringGroup: null }, { recurringGroup: { isManual: false } }],
      },
      select: { id: true, accountId: true, merchantId: true, normalizedDescription: true, date: true, amount: true },
    });

    type Row = (typeof rows)[number];
    const groups = new Map<string, { accountId: string; merchantId: string | null; description: string; rows: Row[] }>();

    for (const row of rows) {
      const description = row.normalizedDescription ?? "";
      if (!row.merchantId && !description) continue;
      const key = `${row.accountId}::${row.merchantId ?? `desc:${description}`}`;
      const existing = groups.get(key);
      if (existing) {
        existing.rows.push(row);
      } else {
        groups.set(key, { accountId: row.accountId, merchantId: row.merchantId, description, rows: [row] });
      }
    }

    let groupsCreated = 0;
    let groupsUpdated = 0;
    let transactionsLinked = 0;

    for (const group of groups.values()) {
      const candidates: RecurringCandidateTransaction[] = group.rows.map((r) => ({
        id: r.id,
        date: r.date,
        amount: Number(r.amount),
      }));
      const pattern = detectRecurringPattern(candidates);
      if (!pattern) continue;

      const existingGroup = await this.prisma.recurringGroup.findFirst({
        where: {
          userId,
          accountId: group.accountId,
          isManual: false,
          ...(group.merchantId ? { merchantId: group.merchantId } : { merchantId: null, description: group.description }),
        },
      });

      const data = {
        frequency: pattern.frequency,
        typicalAmount: pattern.typicalAmount,
        lastDate: pattern.lastDate,
        nextEstimatedDate: pattern.nextEstimatedDate,
        confidence: pattern.confidence,
      };

      let recurringGroupId: string;
      if (existingGroup) {
        await this.prisma.recurringGroup.update({ where: { id: existingGroup.id }, data });
        recurringGroupId = existingGroup.id;
        groupsUpdated++;
      } else {
        const created = await this.prisma.recurringGroup.create({
          data: {
            userId,
            accountId: group.accountId,
            merchantId: group.merchantId,
            description: group.description,
            isManual: false,
            ...data,
          },
        });
        recurringGroupId = created.id;
        groupsCreated++;
      }

      await this.prisma.transaction.updateMany({
        where: { id: { in: pattern.transactionIds } },
        data: { recurringGroupId },
      });
      transactionsLinked += pattern.transactionIds.length;
    }

    return { groupsCreated, groupsUpdated, transactionsLinked };
  }

  async createManual(userId: string, dto: ManualRecurringDto): Promise<RecurringGroupWithEstimates> {
    const transactions = await this.prisma.transaction.findMany({
      where: { id: { in: dto.transactionIds }, deletedAt: null, account: { userId } },
    });

    if (transactions.length !== dto.transactionIds.length) {
      throw new BadRequestException("Alguna de las transacciones indicadas no existe o no te pertenece");
    }

    const accountIds = new Set(transactions.map((t) => t.accountId));
    if (accountIds.size > 1) {
      throw new BadRequestException("Todas las transacciones de un grupo recurrente deben ser de la misma cuenta");
    }

    const signs = new Set(transactions.map((t) => (Number(t.amount) < 0 ? "expense" : "income")));
    if (signs.size > 1) {
      throw new BadRequestException("No se puede mezclar ingresos y gastos en el mismo grupo recurrente");
    }

    const candidates: RecurringCandidateTransaction[] = transactions.map((t) => ({
      id: t.id,
      date: t.date,
      amount: Number(t.amount),
    }));
    const pattern = detectRecurringPattern(candidates);
    if (!pattern) {
      throw new BadRequestException(
        "Estas transacciones no muestran un patrón temporal o de importe suficientemente consistente",
      );
    }

    const merchantId = transactions[0].merchantId;
    const description = transactions[0].normalizedDescription ?? transactions[0].originalDescription;

    const group = await this.prisma.recurringGroup.create({
      data: {
        userId,
        accountId: transactions[0].accountId,
        merchantId,
        description,
        isManual: true,
        frequency: pattern.frequency,
        typicalAmount: pattern.typicalAmount,
        lastDate: pattern.lastDate,
        nextEstimatedDate: pattern.nextEstimatedDate,
        confidence: pattern.confidence,
      },
    });

    await this.prisma.transaction.updateMany({
      where: { id: { in: dto.transactionIds } },
      data: { recurringGroupId: group.id },
    });

    return withEstimates(group);
  }

  async findAll(userId: string, query: ListRecurringQueryDto): Promise<RecurringGroupWithEstimates[]> {
    const groups = await this.prisma.recurringGroup.findMany({
      where: {
        userId,
        ...(query.accountId ? { accountId: query.accountId } : {}),
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      },
      orderBy: { nextEstimatedDate: "asc" },
    });
    return groups.map(withEstimates);
  }

  async findOne(userId: string, id: string): Promise<RecurringGroupWithEstimates> {
    const group = await this.prisma.recurringGroup.findFirst({ where: { id, userId } });
    if (!group) {
      throw new NotFoundException("Grupo recurrente no encontrado");
    }
    return withEstimates(group);
  }

  async update(userId: string, id: string, dto: UpdateRecurringDto): Promise<RecurringGroupWithEstimates> {
    await this.findOne(userId, id);

    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, OR: [{ isSystem: true }, { userId }] },
      });
      if (!category) {
        throw new BadRequestException("La categoría indicada no existe o no es accesible");
      }
    }

    const updated = await this.prisma.recurringGroup.update({
      where: { id },
      data: {
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    return withEstimates(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);
    // Las transacciones enlazadas no se borran: recurringGroupId vuelve a null (onDelete: SetNull).
    await this.prisma.recurringGroup.delete({ where: { id } });
  }
}

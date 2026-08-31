import { Injectable, NotFoundException } from "@nestjs/common";
import { InternalTransfer, InternalTransferStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { DEFAULT_TOLERANCE_DAYS, isAutoConfirmable, matchTransfers, TransferCandidate } from "./transfer-matcher";
import { DetectTransfersDto } from "./dto/detect-transfers.dto";

export interface DetectTransfersResult {
  evaluated: number;
  created: number;
  autoConfirmed: number;
  pending: number;
}

const transferInclude = {
  outgoingTransaction: {
    select: { id: true, accountId: true, date: true, amount: true, originalDescription: true },
  },
  incomingTransaction: {
    select: { id: true, accountId: true, date: true, amount: true, originalDescription: true },
  },
} satisfies Prisma.InternalTransferInclude;

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async detect(userId: string, dto: DetectTransfersDto, ip?: string): Promise<DetectTransfersResult> {
    const toleranceDays = dto.toleranceDays ?? DEFAULT_TOLERANCE_DAYS;

    // Una transaccion con CUALQUIER InternalTransfer ya asociado (pendiente, confirmado o
    // rechazado) no vuelve a proponerse: no se relitiga una decision ya tomada.
    const [outgoingRows, incomingRows] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          deletedAt: null,
          amount: { lt: 0 },
          isInternalTransfer: false,
          outgoingTransfer: null,
          incomingTransfer: null,
          account: { userId, ...(dto.accountId ? { id: dto.accountId } : {}) },
        },
        select: { id: true, accountId: true, date: true, amount: true },
      }),
      this.prisma.transaction.findMany({
        where: {
          deletedAt: null,
          amount: { gt: 0 },
          isInternalTransfer: false,
          outgoingTransfer: null,
          incomingTransfer: null,
          account: { userId },
        },
        select: { id: true, accountId: true, date: true, amount: true },
      }),
    ]);

    const toCandidate = (row: (typeof outgoingRows)[number]): TransferCandidate => ({
      id: row.id,
      accountId: row.accountId,
      date: row.date,
      amount: Number(row.amount),
    });

    const matches = matchTransfers(outgoingRows.map(toCandidate), incomingRows.map(toCandidate), toleranceDays);

    const operations: Prisma.PrismaPromise<unknown>[] = [];
    let autoConfirmed = 0;
    let pending = 0;

    for (const match of matches) {
      const confirmed = isAutoConfirmable(match.confidence);
      operations.push(
        this.prisma.internalTransfer.create({
          data: {
            userId,
            outgoingTransactionId: match.outgoingId,
            incomingTransactionId: match.incomingId,
            status: confirmed ? "CONFIRMED" : "PENDING",
            confidence: match.confidence,
            confirmedVia: confirmed ? "auto" : null,
          },
        }),
      );
      if (confirmed) {
        operations.push(
          this.prisma.transaction.update({ where: { id: match.outgoingId }, data: { isInternalTransfer: true } }),
          this.prisma.transaction.update({ where: { id: match.incomingId }, data: { isInternalTransfer: true } }),
        );
        autoConfirmed++;
      } else {
        pending++;
      }
    }

    if (operations.length > 0) {
      await this.prisma.$transaction(operations);
      await this.auditService.record({
        userId,
        eventType: "TRANSFER_STATUS_CHANGED",
        ip,
        metadata: { source: "detect", created: matches.length, autoConfirmed, pending },
      });
    }

    return {
      evaluated: outgoingRows.length,
      created: matches.length,
      autoConfirmed,
      pending,
    };
  }

  list(userId: string, status?: InternalTransferStatus) {
    return this.prisma.internalTransfer.findMany({
      where: { userId, ...(status ? { status } : {}) },
      include: transferInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(userId: string, id: string): Promise<InternalTransfer> {
    const transfer = await this.prisma.internalTransfer.findFirst({ where: { id, userId }, include: transferInclude });
    if (!transfer) {
      throw new NotFoundException("Transferencia no encontrada");
    }
    return transfer;
  }

  async updateStatus(
    userId: string,
    id: string,
    status: InternalTransferStatus,
    ip?: string,
  ): Promise<InternalTransfer> {
    const existing = await this.findOne(userId, id);
    if (existing.status === status) {
      return existing;
    }

    // Solo mientras esta CONFIRMED se excluyen las dos transacciones de ingresos/gastos: al
    // pasar a PENDING o REJECTED, vuelven a contar como movimientos normales.
    const shouldLinkAsTransfer = status === "CONFIRMED";

    const [updated] = await this.prisma.$transaction([
      this.prisma.internalTransfer.update({
        where: { id },
        data: { status, confirmedVia: status === "CONFIRMED" ? "manual" : null },
        include: transferInclude,
      }),
      this.prisma.transaction.update({
        where: { id: existing.outgoingTransactionId },
        data: { isInternalTransfer: shouldLinkAsTransfer },
      }),
      this.prisma.transaction.update({
        where: { id: existing.incomingTransactionId },
        data: { isInternalTransfer: shouldLinkAsTransfer },
      }),
    ]);

    await this.auditService.record({
      userId,
      eventType: "TRANSFER_STATUS_CHANGED",
      ip,
      metadata: { transferId: id, from: existing.status, to: status },
    });

    return updated;
  }
}

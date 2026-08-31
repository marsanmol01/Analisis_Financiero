import { Injectable } from "@nestjs/common";
import { AuditEventType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

interface RecordEventInput {
  userId?: string;
  eventType: AuditEventType;
  ip?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  // Nunca debe recibir contraseñas, tokens, secretos ni datos completos de tarjeta/cuenta.
  async record({ userId, eventType, ip, metadata }: RecordEventInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId,
        eventType,
        ip,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
}

import { Injectable, NotFoundException } from "@nestjs/common";
import { Account } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAccountDto } from "./dto/create-account.dto";
import { UpdateAccountDto } from "./dto/update-account.dto";

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAccountDto): Promise<Account> {
    const account = await this.prisma.account.create({
      data: {
        userId,
        name: dto.name,
        entity: dto.entity,
        alias: dto.alias,
        type: dto.type,
        currency: dto.currency ?? "EUR",
        balance: dto.balance ?? 0,
        balanceDate: dto.balanceDate ? new Date(dto.balanceDate) : undefined,
        isActive: dto.isActive ?? true,
        externalId: dto.externalId,
        ibanMask: dto.ibanMask,
        notes: dto.notes,
      },
    });

    // Primera foto del saldo: sin esta, "evolucion del patrimonio" no tendria ningun punto de
    // partida para esta cuenta hasta el primer cambio de saldo posterior.
    await this.snapshotBalance(userId, account.id, account.balance);

    return account;
  }

  findAll(userId: string): Promise<Account[]> {
    return this.prisma.account.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
  }

  async findOne(userId: string, id: string): Promise<Account> {
    // El filtro por userId aqui, no solo por id, es lo que impide el acceso cruzado entre usuarios.
    const account = await this.prisma.account.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!account) {
      throw new NotFoundException("Cuenta no encontrada");
    }
    return account;
  }

  async update(userId: string, id: string, dto: UpdateAccountDto): Promise<Account> {
    await this.findOne(userId, id);

    const account = await this.prisma.account.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.entity !== undefined && { entity: dto.entity }),
        ...(dto.alias !== undefined && { alias: dto.alias }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.balance !== undefined && { balance: dto.balance }),
        ...(dto.balanceDate !== undefined && { balanceDate: new Date(dto.balanceDate) }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.externalId !== undefined && { externalId: dto.externalId }),
        ...(dto.ibanMask !== undefined && { ibanMask: dto.ibanMask }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    // Solo se registra una foto nueva si el saldo realmente cambio, para no llenar el historico
    // de puntos identicos cuando se edita el nombre, la entidad, etc.
    if (dto.balance !== undefined) {
      await this.snapshotBalance(userId, account.id, account.balance);
    }

    return account;
  }

  private snapshotBalance(userId: string, accountId: string, balance: Account["balance"]): Promise<unknown> {
    return this.prisma.balanceSnapshot.create({ data: { userId, accountId, balance } });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);

    // Soft delete: la cuenta y su historial permanecen en base de datos, solo se ocultan.
    await this.prisma.account.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

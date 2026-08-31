import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../../../../.env") });

import { ConfigService } from "@nestjs/config";
import { NotFoundException } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AccountsService } from "../accounts/accounts.service";
import { TransfersService } from "./transfers.service";

describe("TransfersService (integracion real: deteccion, confianza, aislamiento)", () => {
  let prisma: PrismaService;
  let accountsService: AccountsService;
  let service: TransfersService;
  let userA: { id: string };
  let userB: { id: string };
  let accountA1: { id: string };
  let accountA2: { id: string };

  beforeAll(async () => {
    const config = { getOrThrow: (key: string) => process.env[key] } as unknown as ConfigService;
    prisma = new PrismaService(config);
    await prisma.onModuleInit();
    const auditService = new AuditService(prisma);
    accountsService = new AccountsService(prisma);
    service = new TransfersService(prisma, auditService);

    const passwordHash = await argon2.hash("not-used-in-this-test", { type: argon2.argon2id });
    const suffix = Date.now();
    userA = await prisma.user.create({ data: { email: `transfers-a-${suffix}@example.test`, passwordHash } });
    userB = await prisma.user.create({ data: { email: `transfers-b-${suffix}@example.test`, passwordHash } });
    accountA1 = await accountsService.create(userA.id, { name: "Cuenta A1", type: "CHECKING", currency: "EUR" });
    accountA2 = await accountsService.create(userA.id, { name: "Cuenta A2", type: "SAVINGS", currency: "EUR" });
  });

  afterAll(async () => {
    await prisma.internalTransfer.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.transaction.deleteMany({ where: { accountId: { in: [accountA1.id, accountA2.id] } } });
    await prisma.account.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.onModuleDestroy();
  });

  let counter = 0;
  async function createTx(accountId: string, date: string, amount: number, description = "MOVIMIENTO") {
    counter++;
    return prisma.transaction.create({
      data: {
        accountId,
        date: new Date(date),
        originalDescription: description,
        normalizedDescription: description,
        amount,
        isExpense: amount < 0,
        isIncome: amount > 0,
        fingerprint: `fp-transfer-test-${counter}-${Date.now()}`,
      },
    });
  }

  it("detecta y autoconfirma una transferencia del mismo dia, marcando is_internal_transfer en ambas", async () => {
    const out = await createTx(accountA1.id, "2026-08-01", -1000, "TRASPASO A AHORRO");
    const inc = await createTx(accountA2.id, "2026-08-01", 1000, "TRASPASO DESDE CORRIENTE");

    const result = await service.detect(userA.id, { accountId: accountA1.id });

    expect(result.created).toBe(1);
    expect(result.autoConfirmed).toBe(1);
    expect(result.pending).toBe(0);

    const refreshedOut = await prisma.transaction.findUnique({ where: { id: out.id } });
    const refreshedInc = await prisma.transaction.findUnique({ where: { id: inc.id } });
    expect(refreshedOut?.isInternalTransfer).toBe(true);
    expect(refreshedInc?.isInternalTransfer).toBe(true);

    const transfers = await service.list(userA.id, "CONFIRMED");
    expect(transfers.find((t) => t.outgoingTransactionId === out.id)?.confirmedVia).toBe("auto");
  });

  it("una transferencia en el limite de tolerancia queda pendiente, sin excluirse todavia de ingresos/gastos", async () => {
    const out = await createTx(accountA1.id, "2026-08-05", -300, "TRASPASO LENTO");
    const inc = await createTx(accountA2.id, "2026-08-08", 300, "TRASPASO LENTO RECIBIDO"); // 3 dias

    const result = await service.detect(userA.id, { accountId: accountA1.id, toleranceDays: 3 });

    expect(result.pending).toBeGreaterThanOrEqual(1);

    const refreshedOut = await prisma.transaction.findUnique({ where: { id: out.id } });
    const refreshedInc = await prisma.transaction.findUnique({ where: { id: inc.id } });
    expect(refreshedOut?.isInternalTransfer).toBe(false);
    expect(refreshedInc?.isInternalTransfer).toBe(false);

    const pendingTransfers = await service.list(userA.id, "PENDING");
    expect(pendingTransfers.find((t) => t.outgoingTransactionId === out.id)).toBeDefined();
  });

  it("volver a ejecutar detect no vuelve a proponer transacciones ya decididas (idempotencia)", async () => {
    const before = await service.list(userA.id);
    const result = await service.detect(userA.id, { accountId: accountA1.id });
    const after = await service.list(userA.id);

    expect(result.created).toBe(0);
    expect(after.length).toBe(before.length);
  });

  it("confirmar manualmente una transferencia pendiente la marca confirmedVia=manual y activa el flag", async () => {
    const pending = (await service.list(userA.id, "PENDING"))[0];
    expect(pending).toBeDefined();

    const updated = await service.updateStatus(userA.id, pending.id, "CONFIRMED");

    expect(updated.confirmedVia).toBe("manual");
    const refreshedOut = await prisma.transaction.findUnique({ where: { id: pending.outgoingTransactionId } });
    expect(refreshedOut?.isInternalTransfer).toBe(true);
  });

  it("rechazar una transferencia confirmada la deshace: vuelve a contar como movimiento normal", async () => {
    const confirmed = (await service.list(userA.id, "CONFIRMED"))[0];
    expect(confirmed).toBeDefined();

    await service.updateStatus(userA.id, confirmed.id, "REJECTED");

    const refreshedOut = await prisma.transaction.findUnique({ where: { id: confirmed.outgoingTransactionId } });
    const refreshedInc = await prisma.transaction.findUnique({ where: { id: confirmed.incomingTransactionId } });
    expect(refreshedOut?.isInternalTransfer).toBe(false);
    expect(refreshedInc?.isInternalTransfer).toBe(false);
  });

  it("un usuario no puede ver ni cambiar el estado de una transferencia de otro usuario", async () => {
    const anyTransfer = (await service.list(userA.id))[0];
    expect(anyTransfer).toBeDefined();

    await expect(service.findOne(userB.id, anyTransfer.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.updateStatus(userB.id, anyTransfer.id, "REJECTED")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("no empareja con un movimiento de otro usuario aunque coincidan importe y fecha exactos", async () => {
    const accountB = await accountsService.create(userB.id, { name: "Cuenta de B", type: "CHECKING", currency: "EUR" });
    await createTx(accountB.id, "2026-08-20", 777, "ENTRADA DE B");
    const outA = await createTx(accountA1.id, "2026-08-20", -777, "SALIDA DE A QUE NO DEBE CRUZARSE CON B");

    await service.detect(userA.id, { accountId: accountA1.id });

    // El unico candidato entrante con ese importe/fecha es de otro usuario: no debe haberse
    // creado ningun InternalTransfer para esta salida.
    const transfer = await prisma.internalTransfer.findUnique({ where: { outgoingTransactionId: outA.id } });
    expect(transfer).toBeNull();

    await prisma.transaction.deleteMany({ where: { accountId: accountB.id } });
    await prisma.account.delete({ where: { id: accountB.id } });
  });
});

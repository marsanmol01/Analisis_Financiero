import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../../../../.env") });

import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AccountsService } from "../accounts/accounts.service";
import { ClassificationRulesService } from "../classification-rules/classification-rules.service";
import { TransactionsService } from "./transactions.service";

describe("TransactionsService (correcciones que enseñan al sistema)", () => {
  let prisma: PrismaService;
  let accountsService: AccountsService;
  let rulesService: ClassificationRulesService;
  let service: TransactionsService;
  let user: { id: string };
  let account: { id: string };
  let categoryId: string;

  beforeAll(async () => {
    const config = { getOrThrow: (key: string) => process.env[key] } as unknown as ConfigService;
    prisma = new PrismaService(config);
    await prisma.onModuleInit();
    const auditService = new AuditService(prisma);
    accountsService = new AccountsService(prisma);
    rulesService = new ClassificationRulesService(prisma, auditService);
    service = new TransactionsService(prisma, rulesService);

    const passwordHash = await argon2.hash("not-used-in-this-test", { type: argon2.argon2id });
    user = await prisma.user.create({
      data: { email: `tx-correction-${Date.now()}@example.test`, passwordHash },
    });
    account = await accountsService.create(user.id, {
      name: "Cuenta correcciones",
      type: "CHECKING",
      currency: "EUR",
    });

    const category = await prisma.category.findFirst({ where: { isSystem: true } });
    if (!category) throw new Error("Se esperaban categorías del sistema ya sembradas (npm run prisma:seed)");
    categoryId = category.id;
  });

  afterAll(async () => {
    await prisma.classificationRule.deleteMany({ where: { userId: user.id } });
    await prisma.transaction.deleteMany({ where: { accountId: account.id } });
    await prisma.account.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.onModuleDestroy();
  });

  async function createTx(description: string, amount: number) {
    return prisma.transaction.create({
      data: {
        accountId: account.id,
        date: new Date("2026-08-01"),
        originalDescription: description,
        normalizedDescription: description,
        amount,
        isExpense: amount < 0,
        isIncome: amount > 0,
        fingerprint: `fp-${description}-${Math.random()}`,
      },
    });
  }

  it("applyToSimilar corrige otras transacciones con la misma descripción, sin tocar las ya corregidas a mano", async () => {
    const target = await createTx("MERCADONA 4287", -45.3);
    const similarUnclassified = await createTx("MERCADONA 4287", -12.1);
    const similarAlreadyManual = await createTx("MERCADONA 4287", -8.5);
    await service.update(user.id, similarAlreadyManual.id, { categoryId, applyToSimilar: false });

    const result = await service.update(user.id, target.id, { categoryId, applyToSimilar: true });

    expect(result.similarUpdatedCount).toBe(1);

    const refreshed = await prisma.transaction.findUnique({ where: { id: similarUnclassified.id } });
    expect(refreshed?.categoryId).toBe(categoryId);
    expect(refreshed?.classificationSource).toBe("manual");
  });

  it("createRule crea una regla visible y editable a partir de la correccion", async () => {
    const tx = await createTx("NETFLIX.COM UNICO", -12.99);

    const result = await service.update(user.id, tx.id, { categoryId, createRule: true });

    expect(result.ruleCreated).toBeDefined();
    expect(result.ruleCreated?.value).toBe("NETFLIX.COM UNICO");
    expect(result.ruleCreated?.createdVia).toBe("correction");

    const rules = await rulesService.findAll(user.id);
    expect(rules.find((r) => r.id === result.ruleCreated?.id)).toBeDefined();
  });

  it("no crea regla ni toca similares si no se piden esas opciones", async () => {
    const tx = await createTx("GASOLINERA REPSOL UNICA", -55);
    const result = await service.update(user.id, tx.id, { categoryId });

    expect(result.ruleCreated).toBeUndefined();
    expect(result.similarUpdatedCount).toBeUndefined();
  });
});

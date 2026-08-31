import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../../../../.env") });

import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AccountsService } from "../accounts/accounts.service";
import { ClassificationRulesService } from "../classification-rules/classification-rules.service";
import { ClassificationService } from "./classification.service";

describe("ClassificationService.reclassify (integracion real)", () => {
  let prisma: PrismaService;
  let accountsService: AccountsService;
  let rulesService: ClassificationRulesService;
  let classificationService: ClassificationService;
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
    classificationService = new ClassificationService(prisma);

    const passwordHash = await argon2.hash("not-used-in-this-test", { type: argon2.argon2id });
    user = await prisma.user.create({
      data: { email: `reclassify-${Date.now()}@example.test`, passwordHash },
    });
    account = await accountsService.create(user.id, {
      name: "Cuenta reclasificacion",
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

  async function createTx(description: string, amount: number, extra: Partial<{ classificationSource: string; categoryId: string }> = {}) {
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
        ...extra,
      },
    });
  }

  it("reclasifica transacciones ya importadas al añadir una regla nueva, sin tocar las manuales", async () => {
    const unclassified = await createTx("VUELO IBERIA BARCELONA", -120);
    const manuallySet = await createTx("VUELO IBERIA BARCELONA", -95, {
      classificationSource: "manual",
      categoryId,
    });

    await rulesService.create(user.id, { operator: "CONTAINS", value: "VUELO IBERIA", categoryId });

    const result = await classificationService.reclassify(user.id, account.id);

    expect(result.updated).toBeGreaterThanOrEqual(1);

    const refreshedUnclassified = await prisma.transaction.findUnique({ where: { id: unclassified.id } });
    expect(refreshedUnclassified?.categoryId).toBe(categoryId);
    expect(refreshedUnclassified?.classificationSource).toBe("rule");

    const refreshedManual = await prisma.transaction.findUnique({ where: { id: manuallySet.id } });
    expect(refreshedManual?.classificationSource).toBe("manual");
  });
});

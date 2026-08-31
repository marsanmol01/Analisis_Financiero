import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../../../../.env") });

import { ConfigService } from "@nestjs/config";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AccountsService } from "../accounts/accounts.service";
import { ClassificationRulesService } from "./classification-rules.service";

describe("ClassificationRulesService (aislamiento e integracion real)", () => {
  let prisma: PrismaService;
  let auditService: AuditService;
  let accountsService: AccountsService;
  let service: ClassificationRulesService;
  let userA: { id: string };
  let userB: { id: string };
  let categoryId: string;

  beforeAll(async () => {
    const config = { getOrThrow: (key: string) => process.env[key] } as unknown as ConfigService;
    prisma = new PrismaService(config);
    await prisma.onModuleInit();
    auditService = new AuditService(prisma);
    accountsService = new AccountsService(prisma);
    service = new ClassificationRulesService(prisma, auditService);

    const passwordHash = await argon2.hash("not-used-in-this-test", { type: argon2.argon2id });
    const suffix = Date.now();
    userA = await prisma.user.create({ data: { email: `rules-a-${suffix}@example.test`, passwordHash } });
    userB = await prisma.user.create({ data: { email: `rules-b-${suffix}@example.test`, passwordHash } });

    const category = await prisma.category.findFirst({ where: { isSystem: true } });
    if (!category) throw new Error("Se esperaban categorías del sistema ya sembradas (npm run prisma:seed)");
    categoryId = category.id;
  });

  afterAll(async () => {
    await prisma.classificationRule.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.account.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.onModuleDestroy();
  });

  it("crea una regla y registra auditoria RULE_CREATED", async () => {
    const rule = await service.create(userA.id, { operator: "CONTAINS", value: "MERCADONA", categoryId });

    const log = await prisma.auditLog.findFirst({ where: { eventType: "RULE_CREATED", userId: userA.id } });
    expect(log?.metadata).toMatchObject({ ruleId: rule.id, createdVia: "manual" });
  });

  it("rechaza un patron regex invalido", async () => {
    await expect(
      service.create(userA.id, { operator: "REGEX", value: "(", categoryId }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza una regla con accountId de otro usuario", async () => {
    const accountOfB = await accountsService.create(userB.id, {
      name: "Cuenta de B",
      type: "CHECKING",
      currency: "EUR",
    });

    await expect(
      service.create(userA.id, { operator: "CONTAINS", value: "X", categoryId, accountId: accountOfB.id }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await prisma.account.delete({ where: { id: accountOfB.id } });
  });

  it("un usuario no puede leer, modificar ni borrar la regla de otro usuario", async () => {
    const rule = await service.create(userA.id, { operator: "CONTAINS", value: "NETFLIX", categoryId });

    await expect(service.findOne(userB.id, rule.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(userB.id, rule.id, { value: "hackeada" })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.remove(userB.id, rule.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("el listado de un usuario no incluye reglas de otro usuario, ordenado por prioridad", async () => {
    await service.create(userA.id, { operator: "CONTAINS", value: "BAJA", categoryId, priority: 200 });
    await service.create(userA.id, { operator: "CONTAINS", value: "ALTA", categoryId, priority: 1 });
    await service.create(userB.id, { operator: "CONTAINS", value: "DE OTRO USUARIO", categoryId });

    const rulesA = await service.findAll(userA.id);
    expect(rulesA.every((r) => r.value !== "DE OTRO USUARIO")).toBe(true);
    const highPriorityIndex = rulesA.findIndex((r) => r.value === "ALTA");
    const lowPriorityIndex = rulesA.findIndex((r) => r.value === "BAJA");
    expect(highPriorityIndex).toBeLessThan(lowPriorityIndex);
  });
});

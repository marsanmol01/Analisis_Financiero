import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../../../../.env") });

import { ConfigService } from "@nestjs/config";
import { NotFoundException } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { MerchantsService } from "./merchants.service";

describe("MerchantsService (aislamiento e integracion real)", () => {
  let prisma: PrismaService;
  let service: MerchantsService;
  let userA: { id: string };
  let userB: { id: string };

  beforeAll(async () => {
    const config = { getOrThrow: (key: string) => process.env[key] } as unknown as ConfigService;
    prisma = new PrismaService(config);
    await prisma.onModuleInit();
    service = new MerchantsService(prisma);

    const passwordHash = await argon2.hash("not-used-in-this-test", { type: argon2.argon2id });
    const suffix = Date.now();
    userA = await prisma.user.create({ data: { email: `merchants-a-${suffix}@example.test`, passwordHash } });
    userB = await prisma.user.create({ data: { email: `merchants-b-${suffix}@example.test`, passwordHash } });
  });

  afterAll(async () => {
    await prisma.merchant.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.onModuleDestroy();
  });

  it("crea un comercio con alias y lo normaliza (mayusculas, espacios)", async () => {
    const merchant = await service.create(userA.id, { name: "Mercadona" });
    const alias = await service.addAlias(userA.id, merchant.id, { pattern: "  mercadona   4287  " });

    expect(alias.pattern).toBe("MERCADONA 4287");
  });

  it("rechaza un nombre de comercio duplicado para el mismo usuario", async () => {
    await service.create(userA.id, { name: "Netflix" });
    await expect(service.create(userA.id, { name: "Netflix" })).rejects.toThrow();
  });

  it("un usuario no puede leer, modificar ni borrar el comercio de otro usuario", async () => {
    const merchant = await service.create(userA.id, { name: "Spotify" });

    await expect(service.findOne(userB.id, merchant.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(userB.id, merchant.id, { name: "hackeado" })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.remove(userB.id, merchant.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("un usuario no puede añadir ni borrar alias del comercio de otro usuario", async () => {
    const merchant = await service.create(userA.id, { name: "Amazon" });

    await expect(service.addAlias(userB.id, merchant.id, { pattern: "AMAZON" })).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const alias = await service.addAlias(userA.id, merchant.id, { pattern: "AMAZON" });
    await expect(service.removeAlias(userB.id, merchant.id, alias.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("el listado de un usuario no incluye comercios de otro usuario", async () => {
    await service.create(userA.id, { name: "Comercio exclusivo de A" });
    const listB = await service.findAll(userB.id);
    expect(listB.find((m) => m.name === "Comercio exclusivo de A")).toBeUndefined();
  });
});

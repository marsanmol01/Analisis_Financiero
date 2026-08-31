import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { PrismaService } from "../prisma/prisma.service";

type MockPrisma = {
  category: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

function createMockPrisma(): MockPrisma {
  return {
    category: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

describe("CategoriesService", () => {
  let prisma: MockPrisma;
  let service: CategoriesService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new CategoriesService(prisma as unknown as PrismaService);
  });

  it("findAll incluye categorías del sistema y propias del usuario", async () => {
    prisma.category.findMany.mockResolvedValue([]);

    await service.findAll("user-1");

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { OR: [{ isSystem: true }, { userId: "user-1" }] },
      orderBy: { name: "asc" },
    });
  });

  it("create rechaza un parentId que no es accesible para el usuario", async () => {
    prisma.category.findFirst.mockResolvedValue(null); // parent no encontrado/accesible

    await expect(
      service.create("user-1", { name: "Subcategoría", parentId: "parent-de-otro-usuario" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.category.create).not.toHaveBeenCalled();
  });

  it("create permite un parentId que es una categoría del sistema", async () => {
    prisma.category.findFirst.mockResolvedValue({ id: "parent-1", isSystem: true });
    prisma.category.create.mockResolvedValue({ id: "new-1" });

    await service.create("user-1", { name: "Mi subcategoría", parentId: "parent-1" });

    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { userId: "user-1", name: "Mi subcategoría", parentId: "parent-1", isSystem: false },
    });
  });

  it("update rechaza modificar una categoría del sistema (403, no 404)", async () => {
    prisma.category.findFirst.mockResolvedValue({ id: "cat-1", isSystem: true, userId: null });

    await expect(service.update("user-1", "cat-1", { name: "Hackeada" })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it("update rechaza modificar una categoría de otro usuario (404, sin filtrar existencia)", async () => {
    // findOne (accesible para lectura porque OR isSystem/userId no aplicaría aquí) simula que
    // no se encuentra nada visible perteneciente a otro usuario.
    prisma.category.findFirst.mockResolvedValue(null);

    await expect(service.update("user-1", "cat-de-otro", { name: "x" })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("remove borra una categoría propia", async () => {
    prisma.category.findFirst.mockResolvedValue({ id: "cat-1", isSystem: false, userId: "user-1" });
    prisma.category.delete.mockResolvedValue({ id: "cat-1" });

    await service.remove("user-1", "cat-1");

    expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: "cat-1" } });
  });
});

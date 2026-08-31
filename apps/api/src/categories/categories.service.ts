import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Category } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { OR: [{ isSystem: true }, { userId }] },
      orderBy: { name: "asc" },
    });
  }

  async findOne(userId: string, id: string): Promise<Category> {
    const category = await this.prisma.category.findFirst({
      where: { id, OR: [{ isSystem: true }, { userId }] },
    });
    if (!category) {
      throw new NotFoundException("Categoría no encontrada");
    }
    return category;
  }

  private async assertParentIsAccessible(userId: string, parentId: string): Promise<void> {
    const parent = await this.prisma.category.findFirst({
      where: { id: parentId, OR: [{ isSystem: true }, { userId }] },
    });
    if (!parent) {
      throw new BadRequestException("La categoría padre indicada no existe o no es accesible");
    }
  }

  async create(userId: string, dto: CreateCategoryDto): Promise<Category> {
    if (dto.parentId) {
      await this.assertParentIsAccessible(userId, dto.parentId);
    }

    return this.prisma.category.create({
      data: {
        userId,
        name: dto.name,
        parentId: dto.parentId,
        isSystem: false,
      },
    });
  }

  // Solo el propietario puede modificar/borrar; las categorías del sistema son de solo lectura
  // para el usuario. Distinguimos "no existe" (404) de "es del sistema" (403): el usuario ya ve
  // la categoría del sistema en su listado, así que confirmar que existe no filtra nada nuevo.
  private async findOwnedOrThrow(userId: string, id: string): Promise<Category> {
    const category = await this.findOne(userId, id);
    if (category.isSystem) {
      throw new ForbiddenException("Las categorías del sistema no se pueden modificar");
    }
    if (category.userId !== userId) {
      throw new NotFoundException("Categoría no encontrada");
    }
    return category;
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto): Promise<Category> {
    await this.findOwnedOrThrow(userId, id);

    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException("Una categoría no puede ser su propia categoría padre");
      }
      await this.assertParentIsAccessible(userId, dto.parentId);
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
      },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOwnedOrThrow(userId, id);
    await this.prisma.category.delete({ where: { id } });
  }
}

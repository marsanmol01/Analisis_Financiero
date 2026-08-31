import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Merchant, MerchantAlias } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeDescription } from "../imports/normalize-description";
import { CreateMerchantDto } from "./dto/create-merchant.dto";
import { UpdateMerchantDto } from "./dto/update-merchant.dto";
import { CreateMerchantAliasDto } from "./dto/create-merchant-alias.dto";

@Injectable()
export class MerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCategoryAccessible(userId: string, categoryId: string): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, OR: [{ isSystem: true }, { userId }] },
    });
    if (!category) {
      throw new BadRequestException("La categoría indicada no existe o no es accesible");
    }
  }

  findAll(userId: string): Promise<(Merchant & { aliases: MerchantAlias[] })[]> {
    return this.prisma.merchant.findMany({
      where: { userId },
      include: { aliases: true },
      orderBy: { name: "asc" },
    });
  }

  async findOne(userId: string, id: string): Promise<Merchant & { aliases: MerchantAlias[] }> {
    const merchant = await this.prisma.merchant.findFirst({
      where: { id, userId },
      include: { aliases: true },
    });
    if (!merchant) {
      throw new NotFoundException("Comercio no encontrado");
    }
    return merchant;
  }

  async create(userId: string, dto: CreateMerchantDto): Promise<Merchant> {
    if (dto.defaultCategoryId) {
      await this.assertCategoryAccessible(userId, dto.defaultCategoryId);
    }
    const existing = await this.prisma.merchant.findFirst({ where: { userId, name: dto.name } });
    if (existing) {
      throw new ConflictException("Ya tienes un comercio con ese nombre");
    }
    return this.prisma.merchant.create({
      data: { userId, name: dto.name, defaultCategoryId: dto.defaultCategoryId },
    });
  }

  async update(userId: string, id: string, dto: UpdateMerchantDto): Promise<Merchant> {
    await this.findOne(userId, id);
    if (dto.defaultCategoryId) {
      await this.assertCategoryAccessible(userId, dto.defaultCategoryId);
    }
    return this.prisma.merchant.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.defaultCategoryId !== undefined && { defaultCategoryId: dto.defaultCategoryId }),
      },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);
    await this.prisma.merchant.delete({ where: { id } });
  }

  async addAlias(userId: string, merchantId: string, dto: CreateMerchantAliasDto): Promise<MerchantAlias> {
    await this.findOne(userId, merchantId);
    const pattern = normalizeDescription(dto.pattern);

    const existing = await this.prisma.merchantAlias.findFirst({ where: { merchantId, pattern } });
    if (existing) {
      throw new ConflictException("Ese alias ya existe para este comercio");
    }

    return this.prisma.merchantAlias.create({ data: { merchantId, pattern } });
  }

  async removeAlias(userId: string, merchantId: string, aliasId: string): Promise<void> {
    await this.findOne(userId, merchantId);
    const alias = await this.prisma.merchantAlias.findFirst({ where: { id: aliasId, merchantId } });
    if (!alias) {
      throw new NotFoundException("Alias no encontrado");
    }
    await this.prisma.merchantAlias.delete({ where: { id: aliasId } });
  }
}

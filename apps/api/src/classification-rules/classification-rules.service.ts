import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ClassificationRule, RuleOperator } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateRuleDto } from "./dto/create-rule.dto";
import { UpdateRuleDto } from "./dto/update-rule.dto";

interface CreateContext {
  ip?: string;
  createdVia?: string;
}

@Injectable()
export class ClassificationRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private validateRegex(operator: RuleOperator, value: string): void {
    if (operator !== "REGEX") return;
    try {
      new RegExp(value);
    } catch {
      throw new BadRequestException("El patrón regex no es válido");
    }
  }

  private async assertCategoryAccessible(userId: string, categoryId: string): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, OR: [{ isSystem: true }, { userId }] },
    });
    if (!category) {
      throw new BadRequestException("La categoría indicada no existe o no es accesible");
    }
  }

  private async assertAccountAccessible(userId: string, accountId: string): Promise<void> {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId, deletedAt: null } });
    if (!account) {
      throw new BadRequestException("La cuenta indicada no existe o no es accesible");
    }
  }

  findAll(userId: string): Promise<ClassificationRule[]> {
    return this.prisma.classificationRule.findMany({
      where: { userId },
      orderBy: { priority: "asc" },
    });
  }

  async findOne(userId: string, id: string): Promise<ClassificationRule> {
    const rule = await this.prisma.classificationRule.findFirst({ where: { id, userId } });
    if (!rule) {
      throw new NotFoundException("Regla no encontrada");
    }
    return rule;
  }

  // Se llama tanto desde ClassificationRulesController (POST /classification-rules) como desde
  // TransactionsService al aceptar "crear regla" en una correccion manual: la auditoria vive
  // aqui, no en el controller, para cubrir ambos caminos por igual.
  async create(userId: string, dto: CreateRuleDto, context: CreateContext = {}): Promise<ClassificationRule> {
    this.validateRegex(dto.operator, dto.value);
    await this.assertCategoryAccessible(userId, dto.categoryId);
    if (dto.accountId) {
      await this.assertAccountAccessible(userId, dto.accountId);
    }

    const rule = await this.prisma.classificationRule.create({
      data: {
        userId,
        field: dto.field ?? "DESCRIPTION",
        operator: dto.operator,
        value: dto.value,
        accountId: dto.accountId,
        minAmount: dto.minAmount,
        maxAmount: dto.maxAmount,
        categoryId: dto.categoryId,
        priority: dto.priority ?? 100,
        isActive: dto.isActive ?? true,
        createdVia: context.createdVia ?? "manual",
      },
    });

    await this.auditService.record({
      userId,
      eventType: "RULE_CREATED",
      ip: context.ip,
      metadata: { ruleId: rule.id, createdVia: rule.createdVia },
    });

    return rule;
  }

  async update(userId: string, id: string, dto: UpdateRuleDto, ip?: string): Promise<ClassificationRule> {
    const existing = await this.findOne(userId, id);

    if (dto.operator || dto.value) {
      this.validateRegex(dto.operator ?? existing.operator, dto.value ?? existing.value);
    }
    if (dto.categoryId) {
      await this.assertCategoryAccessible(userId, dto.categoryId);
    }
    if (dto.accountId) {
      await this.assertAccountAccessible(userId, dto.accountId);
    }

    const rule = await this.prisma.classificationRule.update({
      where: { id },
      data: {
        ...(dto.field !== undefined && { field: dto.field }),
        ...(dto.operator !== undefined && { operator: dto.operator }),
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.accountId !== undefined && { accountId: dto.accountId }),
        ...(dto.minAmount !== undefined && { minAmount: dto.minAmount }),
        ...(dto.maxAmount !== undefined && { maxAmount: dto.maxAmount }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.auditService.record({ userId, eventType: "RULE_UPDATED", ip, metadata: { ruleId: id } });
    return rule;
  }

  async remove(userId: string, id: string, ip?: string): Promise<void> {
    await this.findOne(userId, id);
    await this.prisma.classificationRule.delete({ where: { id } });
    await this.auditService.record({ userId, eventType: "RULE_DELETED", ip, metadata: { ruleId: id } });
  }
}

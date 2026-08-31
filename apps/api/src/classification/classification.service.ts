import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  ClassifiableTransaction,
  ClassificationResult,
  RuleSet,
  RuleSetMerchant,
  RuleSetRule,
} from "./classification.types";

@Injectable()
export class ClassificationService {
  constructor(private readonly prisma: PrismaService) {}

  // Se carga una vez por lote (importacion, reclasificacion), nunca por fila: evita N+1 queries.
  async loadRuleSet(userId: string): Promise<RuleSet> {
    const [rules, merchants] = await Promise.all([
      this.prisma.classificationRule.findMany({
        where: { userId, isActive: true },
        orderBy: { priority: "asc" },
      }),
      this.prisma.merchant.findMany({ where: { userId }, include: { aliases: true } }),
    ]);

    const aliases: RuleSet["aliases"] = [];
    const merchantsById = new Map<string, RuleSetMerchant>();

    for (const merchant of merchants) {
      merchantsById.set(merchant.id, { id: merchant.id, defaultCategoryId: merchant.defaultCategoryId });
      for (const alias of merchant.aliases) {
        aliases.push({ pattern: alias.pattern, merchantId: merchant.id });
      }
    }
    return {
      rules: rules.map(
        (r): RuleSetRule => ({
          id: r.id,
          operator: r.operator,
          value: r.value,
          accountId: r.accountId,
          minAmount: r.minAmount ? Number(r.minAmount) : null,
          maxAmount: r.maxAmount ? Number(r.maxAmount) : null,
          categoryId: r.categoryId,
        }),
      ),
      aliases,
      merchantsById,
    };
  }

  classify(ruleSet: RuleSet, tx: ClassifiableTransaction): ClassificationResult {
    for (const rule of ruleSet.rules) {
      if (rule.accountId && rule.accountId !== tx.accountId) continue;
      if (rule.minAmount !== null && tx.amount < rule.minAmount) continue;
      if (rule.maxAmount !== null && tx.amount > rule.maxAmount) continue;
      if (this.matchesRule(rule, tx.normalizedDescription)) {
        return {
          categoryId: rule.categoryId,
          merchantId: this.findMerchant(ruleSet, tx.normalizedDescription),
          source: "rule",
          confidence: 1,
        };
      }
    }

    const merchantId = this.findMerchant(ruleSet, tx.normalizedDescription);
    if (merchantId) {
      const merchant = ruleSet.merchantsById.get(merchantId);
      if (merchant?.defaultCategoryId) {
        return { categoryId: merchant.defaultCategoryId, merchantId, source: "merchant", confidence: 0.8 };
      }
      return { categoryId: null, merchantId, source: null, confidence: null };
    }

    return { categoryId: null, merchantId: null, source: null, confidence: null };
  }

  async reclassify(userId: string, accountId?: string): Promise<{ scanned: number; updated: number }> {
    const ruleSet = await this.loadRuleSet(userId);

    // Nunca se toca una transaccion clasificada manualmente: la correccion del usuario siempre
    // tiene la ultima palabra frente a cualquier automatismo.
    const transactions = await this.prisma.transaction.findMany({
      where: {
        deletedAt: null,
        account: { userId, ...(accountId ? { id: accountId } : {}) },
        OR: [{ classificationSource: null }, { classificationSource: { not: "manual" } }],
      },
      select: { id: true, accountId: true, amount: true, normalizedDescription: true },
    });

    let updated = 0;
    for (const tx of transactions) {
      const result = this.classify(ruleSet, {
        accountId: tx.accountId,
        amount: Number(tx.amount),
        normalizedDescription: tx.normalizedDescription ?? "",
      });

      if (result.categoryId !== null || result.merchantId !== null) {
        await this.prisma.transaction.update({
          where: { id: tx.id },
          data: {
            categoryId: result.categoryId,
            merchantId: result.merchantId,
            classificationSource: result.source,
            confidence: result.confidence,
          },
        });
        updated++;
      }
    }

    return { scanned: transactions.length, updated };
  }

  private findMerchant(ruleSet: RuleSet, normalizedDescription: string): string | null {
    // Se busca el patron mas largo entre TODOS los que casan, en vez de quedarse con el primero
    // del array: asi la garantia de "el alias mas especifico gana" no depende de que quien
    // construyo el RuleSet lo haya pre-ordenado (loadRuleSet lo hace, pero no debe ser un
    // requisito implicito para llamar a classify() correctamente).
    let best: { merchantId: string; length: number } | null = null;
    for (const alias of ruleSet.aliases) {
      if (normalizedDescription.includes(alias.pattern) && (!best || alias.pattern.length > best.length)) {
        best = { merchantId: alias.merchantId, length: alias.pattern.length };
      }
    }
    return best?.merchantId ?? null;
  }

  private matchesRule(rule: RuleSetRule, description: string): boolean {
    const value = rule.value.toUpperCase();
    switch (rule.operator) {
      case "CONTAINS":
        return description.includes(value);
      case "STARTS_WITH":
        return description.startsWith(value);
      case "ENDS_WITH":
        return description.endsWith(value);
      case "EXACT":
        return description === value;
      case "REGEX":
        try {
          return new RegExp(rule.value, "i").test(description);
        } catch {
          return false;
        }
    }
  }
}

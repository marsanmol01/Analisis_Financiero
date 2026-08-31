export interface ClassifiableTransaction {
  accountId: string;
  amount: number;
  normalizedDescription: string;
}

export type ClassificationSource = "rule" | "merchant";

export interface ClassificationResult {
  categoryId: string | null;
  merchantId: string | null;
  source: ClassificationSource | null;
  confidence: number | null;
}

export interface RuleSetRule {
  id: string;
  operator: "CONTAINS" | "STARTS_WITH" | "ENDS_WITH" | "EXACT" | "REGEX";
  value: string;
  accountId: string | null;
  minAmount: number | null;
  maxAmount: number | null;
  categoryId: string;
}

export interface RuleSetMerchantAlias {
  pattern: string;
  merchantId: string;
}

export interface RuleSetMerchant {
  id: string;
  defaultCategoryId: string | null;
}

export interface RuleSet {
  rules: RuleSetRule[]; // ya ordenadas por prioridad ascendente
  aliases: RuleSetMerchantAlias[]; // sin orden garantizado: classify() elige siempre el patron mas largo que casa
  merchantsById: Map<string, RuleSetMerchant>;
}

export type RuleOperator = "CONTAINS" | "STARTS_WITH" | "ENDS_WITH" | "EXACT" | "REGEX";

export interface ClassificationRule {
  id: string;
  userId: string;
  field: "DESCRIPTION";
  operator: RuleOperator;
  value: string;
  accountId: string | null;
  minAmount: string | null;
  maxAmount: string | null;
  categoryId: string;
  priority: number;
  isActive: boolean;
  createdVia: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClassificationRuleInput {
  operator: RuleOperator;
  value: string;
  accountId?: string | null;
  minAmount?: number;
  maxAmount?: number;
  categoryId: string;
  priority?: number;
  isActive?: boolean;
}

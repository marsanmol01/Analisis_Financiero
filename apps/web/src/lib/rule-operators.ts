import type { RuleOperator } from "../types/classification-rule";

export const RULE_OPERATOR_LABELS: Record<RuleOperator, string> = {
  CONTAINS: "Contiene",
  STARTS_WITH: "Empieza por",
  ENDS_WITH: "Termina en",
  EXACT: "Es exactamente",
  REGEX: "Coincide con la expresión regular",
};

export const RULE_OPERATOR_OPTIONS = Object.entries(RULE_OPERATOR_LABELS).map(([value, label]) => ({
  value: value as RuleOperator,
  label,
}));

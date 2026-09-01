import type { AccountType } from "../types/account";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CHECKING: "Cuenta corriente",
  SAVINGS: "Cuenta de ahorro",
  CARD: "Tarjeta",
  DIGITAL: "Monedero digital",
  CASH: "Efectivo",
  INVESTMENT: "Inversión",
  DEPOSIT: "Depósito",
  LOAN: "Préstamo",
};

export const ACCOUNT_TYPE_OPTIONS = Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => ({
  value: value as AccountType,
  label,
}));

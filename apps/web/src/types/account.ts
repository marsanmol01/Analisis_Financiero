export type AccountType =
  | "CHECKING"
  | "SAVINGS"
  | "CARD"
  | "DIGITAL"
  | "CASH"
  | "INVESTMENT"
  | "DEPOSIT"
  | "LOAN";

export interface Account {
  id: string;
  name: string;
  entity: string | null;
  alias: string | null;
  type: AccountType;
  currency: string;
  balance: string;
  balanceDate: string | null;
  isActive: boolean;
  externalId: string | null;
  ibanMask: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountInput {
  name: string;
  entity?: string;
  alias?: string;
  type: AccountType;
  currency?: string;
  balance?: number;
  balanceDate?: string;
  isActive?: boolean;
  ibanMask?: string;
  notes?: string;
}

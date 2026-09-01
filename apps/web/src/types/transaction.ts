export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  merchantId: string | null;
  recurringGroupId: string | null;
  date: string;
  valueDate: string | null;
  originalDescription: string;
  normalizedDescription: string | null;
  amount: string;
  currency: string;
  isIncome: boolean;
  isExpense: boolean;
  isInternalTransfer: boolean;
  classificationSource: string | null;
  confidence: string | null;
  notes: string | null;
  sourceFile: string | null;
  externalReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionListResponse {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TransactionFilters {
  accountId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface UpdateTransactionInput {
  categoryId?: string | null;
  notes?: string;
  applyToSimilar?: boolean;
  createRule?: boolean;
}

export interface UpdateTransactionResult {
  transaction: Transaction;
  similarUpdatedCount?: number;
  ruleCreated?: { id: string };
}

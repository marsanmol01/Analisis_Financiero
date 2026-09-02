export type RecurringFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "OTHER";

export interface RecurringGroup {
  id: string;
  userId: string;
  accountId: string;
  merchantId: string | null;
  categoryId: string | null;
  description: string;
  frequency: RecurringFrequency;
  typicalAmount: string;
  lastDate: string;
  nextEstimatedDate: string | null;
  isActive: boolean;
  isManual: boolean;
  confidence: string | null;
  createdAt: string;
  updatedAt: string;
  monthlyEquivalent: number;
  annualEstimate: number;
}

export interface UpdateRecurringInput {
  categoryId?: string | null;
  isActive?: boolean;
}

export interface DetectRecurringResult {
  groupsCreated: number;
  groupsUpdated: number;
  transactionsLinked: number;
}

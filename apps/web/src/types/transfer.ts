export type InternalTransferStatus = "PENDING" | "CONFIRMED" | "REJECTED";

export interface TransferTransactionSummary {
  id: string;
  accountId: string;
  date: string;
  amount: string;
  originalDescription: string;
}

export interface InternalTransfer {
  id: string;
  userId: string;
  outgoingTransactionId: string;
  incomingTransactionId: string;
  status: InternalTransferStatus;
  confidence: string;
  confirmedVia: string | null;
  createdAt: string;
  updatedAt: string;
  outgoingTransaction: TransferTransactionSummary;
  incomingTransaction: TransferTransactionSummary;
}

export interface DetectTransfersResult {
  evaluated: number;
  created: number;
  autoConfirmed: number;
  pending: number;
}

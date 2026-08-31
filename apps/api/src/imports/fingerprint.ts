import { createHash } from "node:crypto";

export interface FingerprintInput {
  accountId: string;
  date: Date;
  amount: number;
  normalizedDescription: string;
  externalReference?: string;
}

// No depende exclusivamente de una referencia bancaria (puede no existir): combina cuenta,
// fecha, importe y descripcion normalizada. Documentado en docs/import-system.md.
export function computeFingerprint(input: FingerprintInput): string {
  const parts = [
    input.accountId,
    input.date.toISOString().slice(0, 10),
    input.amount.toFixed(2),
    input.normalizedDescription,
    input.externalReference ?? "",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

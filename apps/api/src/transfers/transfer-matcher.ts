// Motor de matching candidato-a-candidato, puro (sin acceso a base de datos) y por tanto
// facil de testear a fondo. La confianza cae con la distancia en dias; por encima del umbral
// se autoconfirma, el resto queda pendiente de revision manual.

export interface TransferCandidate {
  id: string;
  accountId: string;
  date: Date;
  amount: number; // con signo: negativo = saliente, positivo = entrante
}

export interface TransferMatch {
  outgoingId: string;
  incomingId: string;
  daysDiff: number;
  confidence: number;
}

export const AUTO_CONFIRM_THRESHOLD = 0.9;
export const DEFAULT_TOLERANCE_DAYS = 3;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / MS_PER_DAY);
}

function computeConfidence(daysDiff: number, toleranceDays: number): number {
  if (toleranceDays <= 0) return daysDiff === 0 ? 1 : 0;
  const decay = (daysDiff / (toleranceDays + 1)) * 0.4;
  return Math.round(Math.max(0, 1 - decay) * 1000) / 1000;
}

export function isAutoConfirmable(confidence: number): boolean {
  return confidence >= AUTO_CONFIRM_THRESHOLD;
}

// Emparejamiento voraz: procesa los salientes por fecha y para cada uno toma, de entre los
// entrantes aun libres, el que mejor casa (mismo importe absoluto, cuenta distinta, dentro de
// la ventana de tolerancia, menor distancia en dias). Un entrante usado no puede reutilizarse.
export function matchTransfers(
  outgoing: TransferCandidate[],
  incoming: TransferCandidate[],
  toleranceDays: number = DEFAULT_TOLERANCE_DAYS,
): TransferMatch[] {
  const matches: TransferMatch[] = [];
  const usedIncoming = new Set<string>();

  const sortedOutgoing = [...outgoing].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const out of sortedOutgoing) {
    let best: { candidate: TransferCandidate; daysDiff: number } | null = null;

    for (const inc of incoming) {
      if (usedIncoming.has(inc.id)) continue;
      if (inc.accountId === out.accountId) continue;
      if (Math.abs(inc.amount) !== Math.abs(out.amount)) continue;

      const daysDiff = daysBetween(out.date, inc.date);
      if (daysDiff > toleranceDays) continue;

      if (!best || daysDiff < best.daysDiff) {
        best = { candidate: inc, daysDiff };
      }
    }

    if (best) {
      usedIncoming.add(best.candidate.id);
      matches.push({
        outgoingId: out.id,
        incomingId: best.candidate.id,
        daysDiff: best.daysDiff,
        confidence: computeConfidence(best.daysDiff, toleranceDays),
      });
    }
  }

  return matches;
}

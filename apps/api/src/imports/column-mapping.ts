// Deteccion automatica de columnas para el importador generico. Si no se puede detectar con
// confianza (fecha + descripcion + [importe o debe/haber]), se debe pedir al usuario un mapeo
// explicito en vez de asumir algo silenciosamente (requisito de calidad de datos).

export interface ColumnMapping {
  date: number;
  valueDate?: number;
  amount?: number;
  debit?: number;
  credit?: number;
  description: number;
  reference?: number;
  currency?: number;
}

const ALIASES: Record<keyof ColumnMapping, string[]> = {
  date: ["fecha", "fecha operacion", "date", "transaction date", "fecha op"],
  valueDate: ["fecha valor", "value date"],
  amount: ["importe", "amount", "cantidad", "importe eur", "importe (eur)"],
  debit: ["debe", "cargo", "debit"],
  credit: ["haber", "abono", "credit"],
  description: ["concepto", "descripcion", "detalle", "description", "movimiento"],
  reference: ["referencia", "reference", "ref", "referencia bancaria"],
  currency: ["moneda", "currency", "divisa"],
};

// Rango Unicode de marcas diacriticas combinantes (U+0300-U+036F), usado tras normalize("NFD")
// para quitar acentos. Construido con RegExp + codigos de punto explicitos para no depender de
// caracteres combinantes literales dentro del propio fichero fuente (dificiles de inspeccionar).
const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

export function normalizeHeader(text: string): string {
  return text
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function detectColumnMapping(headers: string[]): ColumnMapping | null {
  const normalized = headers.map(normalizeHeader);
  const findIndex = (aliases: string[]): number | undefined => {
    const index = normalized.findIndex((header) => aliases.includes(header));
    return index === -1 ? undefined : index;
  };

  const mapping: Partial<ColumnMapping> = {
    date: findIndex(ALIASES.date),
    valueDate: findIndex(ALIASES.valueDate),
    amount: findIndex(ALIASES.amount),
    debit: findIndex(ALIASES.debit),
    credit: findIndex(ALIASES.credit),
    description: findIndex(ALIASES.description),
    reference: findIndex(ALIASES.reference),
    currency: findIndex(ALIASES.currency),
  };

  const hasAmount = mapping.amount !== undefined || (mapping.debit !== undefined && mapping.credit !== undefined);
  if (mapping.date === undefined || mapping.description === undefined || !hasAmount) {
    return null;
  }

  return mapping as ColumnMapping;
}

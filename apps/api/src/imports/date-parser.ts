import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

// Formatos mas comunes en extractos bancarios espanoles/europeos, probados en orden estricto
// (sin adivinar dia/mes de forma ambigua tipo MM/DD). Si ninguno encaja, la fila se marca como
// error en vez de asumir una fecha incorrecta.
const KNOWN_FORMATS = ["YYYY-MM-DD", "DD/MM/YYYY", "DD-MM-YYYY", "DD.MM.YYYY", "YYYY/MM/DD"];

export function parseDate(raw: string): Date | null {
  const text = raw.trim();
  if (text === "") return null;

  for (const format of KNOWN_FORMATS) {
    const parsed = dayjs(text, format, true);
    if (parsed.isValid()) {
      // Se ancla a medianoche UTC del dia calendario detectado: una fecha de extracto bancario
      // no tiene zona horaria propia, y usar la hora local aqui desplazaria el dia al convertir
      // a ISO/UTC en cualquier zona con offset distinto de 0 (ej. Europe/Madrid).
      return new Date(Date.UTC(parsed.year(), parsed.month(), parsed.date()));
    }
  }
  return null;
}

// Parseo tolerante de importes bancarios: admite coma o punto decimal, separador de miles,
// signo negativo delante o parentesis (formato contable), simbolos de moneda/espacios, y un
// codigo de moneda ISO 4217 pegado al numero (p.ej. "-20,99EUR").
// Devuelve null (nunca lanza) cuando el valor es ambiguo o no numerico, para que la fila se
// marque como error visible en vez de asumir un importe incorrecto en silencio.
export function parseAmount(raw: string): number | null {
  let text = raw.trim();
  if (text === "") return null;

  let negative = false;
  if (text.startsWith("(") && text.endsWith(")")) {
    negative = true;
    text = text.slice(1, -1);
  }

  text = text.replace(/[€$\s]/g, "");
  if (text === "") return null;

  // Codigo de moneda ISO 4217 (3 letras, p.ej. "EUR") pegado directamente al numero, sin espacio
  // ni simbolo de por medio (formato real visto en extractos de CaixaBank).
  text = text.replace(/^[a-zA-Z]{3}(?=[\d.,+-])/, "").replace(/(?<=[\d.,])[a-zA-Z]{3}$/, "");
  if (text === "") return null;

  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    text = text.slice(1);
  }

  if (!/^[0-9.,]+$/.test(text)) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");

  let normalized: string;
  if (lastComma !== -1 && lastDot !== -1) {
    // El separador que aparece en ultimo lugar es el decimal; el otro es de miles.
    if (lastComma > lastDot) {
      normalized = text.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = text.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    const decimals = text.length - lastComma - 1;
    normalized = decimals === 3 ? text.replace(",", "") : text.replace(",", ".");
  } else if (lastDot !== -1) {
    const decimals = text.length - lastDot - 1;
    normalized = decimals === 3 ? text.replace(/\./g, "") : text;
  } else {
    normalized = text;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;

  return negative ? -value : value;
}

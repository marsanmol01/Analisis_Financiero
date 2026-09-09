import * as XLSX from "xlsx";
import { LegacyXlsImporter } from "./legacy-xls.importer";

function buildXlsBuffer(rows: (string | number)[][]): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Hoja1");
  return XLSX.write(workbook, { type: "buffer", bookType: "biff8" }) as Buffer;
}

describe("LegacyXlsImporter", () => {
  const importer = new LegacyXlsImporter();

  it("parsea cabecera y filas de un XLS legacy (Excel 97-2003)", () => {
    const buffer = buildXlsBuffer([
      ["Fecha", "Concepto", "Importe"],
      ["01/08/2026", "MERCADONA", -45.3],
      ["02/08/2026", "NOMINA", 2500],
    ]);

    const result = importer.parse(buffer);

    expect(result.headers).toEqual(["Fecha", "Concepto", "Importe"]);
    expect(result.rows).toEqual([
      ["01/08/2026", "MERCADONA", "-45.3"],
      ["02/08/2026", "NOMINA", "2500"],
    ]);
  });

  it("salta un bloque de metadatos (titular, IBAN...) antes de la cabecera real, como hace Sabadell", () => {
    const buffer = buildXlsBuffer([
      ["Consulta de movimientos"],
      ["10/09/2026 0:02:53"],
      [],
      ["Cuenta: ", "ES58 0081 2706 1200 0172 3474"],
      ["Divisa: ", "EUR"],
      ["Titular:", "MARIA SANCHEZ MOLINA"],
      [],
      ["F. Operativa", "Concepto", "F. Valor", "Importe", "Saldo"],
      ["09/09/2026", "COMPRA TARJ. MERCADONA", "09/09/2026", "-45,30", "100,73"],
    ]);

    const result = importer.parse(buffer);

    expect(result.headers).toEqual(["F. Operativa", "Concepto", "F. Valor", "Importe", "Saldo"]);
    expect(result.rows).toEqual([["09/09/2026", "COMPRA TARJ. MERCADONA", "09/09/2026", "-45,30", "100,73"]]);
  });

  it("ignora filas completamente vacias", () => {
    const buffer = buildXlsBuffer([
      ["Fecha", "Concepto", "Importe"],
      ["01/08/2026", "MERCADONA", -45.3],
      ["", "", ""],
      ["02/08/2026", "NOMINA", 2500],
    ]);

    const result = importer.parse(buffer);

    expect(result.rows).toHaveLength(2);
  });

  it("devuelve vacio si la hoja no tiene filas", () => {
    const buffer = buildXlsBuffer([]);
    const result = importer.parse(buffer);
    expect(result).toEqual({ headers: [], rows: [] });
  });
});

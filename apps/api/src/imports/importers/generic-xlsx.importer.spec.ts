import ExcelJS from "exceljs";
import { GenericXlsxImporter } from "./generic-xlsx.importer";

async function buildWorkbookBuffer(rows: (string | number | Date)[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Movimientos");
  rows.forEach((row) => sheet.addRow(row));
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}

describe("GenericXlsxImporter", () => {
  const importer = new GenericXlsxImporter();

  it("parsea cabecera y filas de un XLSX", async () => {
    const buffer = await buildWorkbookBuffer([
      ["Fecha", "Concepto", "Importe"],
      ["01/08/2026", "MERCADONA", -45.3],
      ["02/08/2026", "NOMINA", 2500],
    ]);

    const result = await importer.parse(buffer);

    expect(result.headers).toEqual(["Fecha", "Concepto", "Importe"]);
    expect(result.rows).toEqual([
      ["01/08/2026", "MERCADONA", "-45.3"],
      ["02/08/2026", "NOMINA", "2500"],
    ]);
  });

  it("convierte celdas de tipo fecha a un string ISO reconocible por el parser de fechas", async () => {
    const buffer = await buildWorkbookBuffer([
      ["Fecha", "Concepto", "Importe"],
      [new Date(Date.UTC(2026, 7, 15)), "ALQUILER", -800],
    ]);

    const result = await importer.parse(buffer);

    expect(result.rows[0][0]).toBe("2026-08-15");
  });

  it("ignora filas completamente vacias", async () => {
    const buffer = await buildWorkbookBuffer([
      ["Fecha", "Concepto", "Importe"],
      ["01/08/2026", "MERCADONA", -45.3],
      ["", "", ""],
      ["02/08/2026", "NOMINA", 2500],
    ]);

    const result = await importer.parse(buffer);

    expect(result.rows).toHaveLength(2);
  });

  it("devuelve vacio si la hoja no tiene filas", async () => {
    const buffer = await buildWorkbookBuffer([]);
    const result = await importer.parse(buffer);
    expect(result).toEqual({ headers: [], rows: [] });
  });
});

import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { BankImporter, ParsedFile } from "./bank-importer.interface";

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    // Formato ISO simple para que el parser de fechas comun lo reconozca sin ambiguedad.
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("result" in value) {
      return cellToString(value.result as ExcelJS.CellValue);
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }
    return "";
  }
  return String(value);
}

@Injectable()
export class GenericXlsxImporter implements BankImporter {
  async parse(buffer: Buffer): Promise<ParsedFile> {
    const workbook = new ExcelJS.Workbook();
    // exceljs trae su propia definicion de Buffer ligeramente distinta a la de @types/node del
    // proyecto; el cast es seguro porque en ambos casos es el mismo Buffer en tiempo de ejecucion.
    await workbook.xlsx.load(buffer as never);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return { headers: [], rows: [] };
    }

    const allRows: string[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values as ExcelJS.CellValue[]; // indice 0 vacio, 1-indexado
      const cells = values.slice(1).map(cellToString);
      if (cells.some((cell) => cell.trim() !== "")) {
        allRows.push(cells);
      }
    });

    if (allRows.length === 0) {
      return { headers: [], rows: [] };
    }

    const [headers, ...rows] = allRows;
    return { headers, rows };
  }
}

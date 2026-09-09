import { Injectable } from "@nestjs/common";
import * as XLSX from "xlsx";
import { BankImporter, ParsedFile } from "./bank-importer.interface";
import { detectColumnMapping } from "../column-mapping";

// Algunos bancos (p. ej. Sabadell) anteponen un bloque de metadatos (titular, IBAN, fecha de
// generacion...) antes de la fila de cabecera real. Se escanean como maximo estas filas buscando
// la primera que el detector de columnas reconozca como cabecera valida.
const MAX_HEADER_SCAN_ROWS = 30;

@Injectable()
export class LegacyXlsImporter implements BankImporter {
  parse(buffer: Buffer): ParsedFile {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { headers: [], rows: [] };

    const sheet = workbook.Sheets[sheetName];
    const allRows = XLSX.utils
      .sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" })
      .map((row) => row.map((cell) => String(cell ?? "").trim()))
      .filter((row) => row.some((cell) => cell !== ""));

    if (allRows.length === 0) return { headers: [], rows: [] };

    const scanLimit = Math.min(allRows.length, MAX_HEADER_SCAN_ROWS);
    for (let i = 0; i < scanLimit; i++) {
      if (detectColumnMapping(allRows[i])) {
        return { headers: allRows[i], rows: allRows.slice(i + 1) };
      }
    }

    // Si ninguna fila coincide con un mapeo automatico, se asume la primera como cabecera
    // (igual que el resto de importadores) y se delega en el mapeo manual del usuario.
    const [headers, ...rows] = allRows;
    return { headers, rows };
  }
}

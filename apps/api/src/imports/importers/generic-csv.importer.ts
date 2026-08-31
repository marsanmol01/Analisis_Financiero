import { Injectable } from "@nestjs/common";
import { parse } from "csv-parse/sync";
import { BankImporter, ParsedFile } from "./bank-importer.interface";

const CANDIDATE_DELIMITERS = [",", ";", "\t"];

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function detectDelimiter(firstLine: string): string {
  let best = CANDIDATE_DELIMITERS[0];
  let bestCount = -1;
  for (const delimiter of CANDIDATE_DELIMITERS) {
    const count = firstLine.split(delimiter).length - 1;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

@Injectable()
export class GenericCsvImporter implements BankImporter {
  parse(buffer: Buffer): ParsedFile {
    const text = stripBom(buffer.toString("utf-8"));
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    const delimiter = detectDelimiter(firstLine);

    // csv-parse maneja correctamente campos entrecomillados con saltos de linea internos
    // (descripciones multilinea) y celdas con el propio delimitador dentro de comillas.
    const records: string[][] = parse(text, {
      delimiter,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) {
      return { headers: [], rows: [] };
    }

    const [headers, ...rows] = records;
    return { headers, rows };
  }
}

// Contrato comun para cualquier importador de banco. GenericCSVImporter y
// GenericXlsxImporter lo implementan hoy; importadores especificos por banco
// (BancoXImporter, RevolutImporter...) lo implementaran mas adelante sin tocar
// el resto del pipeline de importacion.
export interface ParsedFile {
  headers: string[];
  rows: string[][];
}

export interface BankImporter {
  parse(buffer: Buffer): ParsedFile | Promise<ParsedFile>;
}

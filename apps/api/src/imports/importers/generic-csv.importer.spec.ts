import { GenericCsvImporter } from "./generic-csv.importer";

describe("GenericCsvImporter", () => {
  const importer = new GenericCsvImporter();

  it("parsea un CSV separado por comas", () => {
    const csv = "Fecha,Concepto,Importe\n01/08/2026,MERCADONA,-45.30\n02/08/2026,NOMINA,2500.00\n";
    const result = importer.parse(Buffer.from(csv, "utf-8"));

    expect(result.headers).toEqual(["Fecha", "Concepto", "Importe"]);
    expect(result.rows).toEqual([
      ["01/08/2026", "MERCADONA", "-45.30"],
      ["02/08/2026", "NOMINA", "2500.00"],
    ]);
  });

  it("detecta y parsea un CSV separado por punto y coma", () => {
    const csv = "Fecha;Concepto;Importe\n01/08/2026;MERCADONA;-45,30\n";
    const result = importer.parse(Buffer.from(csv, "utf-8"));

    expect(result.headers).toEqual(["Fecha", "Concepto", "Importe"]);
    expect(result.rows).toEqual([["01/08/2026", "MERCADONA", "-45,30"]]);
  });

  it("respeta descripciones multilinea entre comillas", () => {
    const csv = 'Fecha,Concepto,Importe\n01/08/2026,"LINEA UNO\nLINEA DOS",-10.00\n';
    const result = importer.parse(Buffer.from(csv, "utf-8"));

    expect(result.rows[0][1]).toBe("LINEA UNO\nLINEA DOS");
  });

  it("ignora filas completamente vacias", () => {
    const csv = "Fecha,Concepto,Importe\n01/08/2026,MERCADONA,-45.30\n\n\n02/08/2026,NOMINA,2500.00\n";
    const result = importer.parse(Buffer.from(csv, "utf-8"));

    expect(result.rows).toHaveLength(2);
  });

  it("quita el BOM UTF-8 si esta presente", () => {
    const csv = "﻿Fecha,Concepto,Importe\n01/08/2026,MERCADONA,-45.30\n";
    const result = importer.parse(Buffer.from(csv, "utf-8"));

    expect(result.headers[0]).toBe("Fecha");
  });

  it("devuelve vacio para un fichero sin filas", () => {
    const result = importer.parse(Buffer.from("", "utf-8"));
    expect(result).toEqual({ headers: [], rows: [] });
  });
});

import { detectColumnMapping } from "./column-mapping";

describe("detectColumnMapping", () => {
  it("detecta columnas en espanol con un importe unico", () => {
    const mapping = detectColumnMapping(["Fecha", "Concepto", "Importe"]);
    expect(mapping).toEqual({ date: 0, description: 1, amount: 2 });
  });

  it("detecta columnas debe/haber en vez de importe unico", () => {
    const mapping = detectColumnMapping(["Fecha", "Concepto", "Debe", "Haber"]);
    expect(mapping).toMatchObject({ date: 0, description: 1, debit: 2, credit: 3 });
  });

  it("detecta columnas en ingles", () => {
    const mapping = detectColumnMapping(["Date", "Description", "Amount"]);
    expect(mapping).toEqual({ date: 0, description: 1, amount: 2 });
  });

  it("ignora acentos y mayusculas", () => {
    const mapping = detectColumnMapping(["FECHA", "DESCRIPCIÓN", "IMPORTE"]);
    expect(mapping).toEqual({ date: 0, description: 1, amount: 2 });
  });

  it("devuelve null si faltan columnas imprescindibles (sin importe ni debe/haber)", () => {
    expect(detectColumnMapping(["Fecha", "Concepto"])).toBeNull();
  });

  it("devuelve null si no hay ninguna columna reconocible", () => {
    expect(detectColumnMapping(["Columna A", "Columna B", "Columna C"])).toBeNull();
  });
});

import { parseAmount } from "./amount-parser";

describe("parseAmount", () => {
  it("parsea decimal con punto", () => {
    expect(parseAmount("45.30")).toBeCloseTo(45.3);
  });

  it("parsea decimal con coma", () => {
    expect(parseAmount("45,30")).toBeCloseTo(45.3);
  });

  it("parsea formato europeo con miles y decimales (1.234,56)", () => {
    expect(parseAmount("1.234,56")).toBeCloseTo(1234.56);
  });

  it("parsea formato anglosajon con miles y decimales (1,234.56)", () => {
    expect(parseAmount("1,234.56")).toBeCloseTo(1234.56);
  });

  it("parsea negativos con signo delante", () => {
    expect(parseAmount("-45,30")).toBeCloseTo(-45.3);
  });

  it("parsea negativos en formato contable con parentesis", () => {
    expect(parseAmount("(45,30)")).toBeCloseTo(-45.3);
  });

  it("ignora simbolo de moneda y espacios", () => {
    expect(parseAmount("€ 45,30")).toBeCloseTo(45.3);
    expect(parseAmount("45,30 €")).toBeCloseTo(45.3);
  });

  it("devuelve null para vacio", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
  });

  it("devuelve null para texto no numerico", () => {
    expect(parseAmount("no es un importe")).toBeNull();
  });

  it("trata 1,234 (sin decimales, 3 digitos tras coma) como miles", () => {
    expect(parseAmount("1,234")).toBeCloseTo(1234);
  });
});

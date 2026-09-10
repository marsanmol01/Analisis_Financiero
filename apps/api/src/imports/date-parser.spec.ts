import { parseDate } from "./date-parser";

describe("parseDate", () => {
  it("parsea ISO (YYYY-MM-DD)", () => {
    const date = parseDate("2026-08-15");
    expect(date?.toISOString().slice(0, 10)).toBe("2026-08-15");
  });

  it("parsea DD/MM/YYYY", () => {
    const date = parseDate("15/08/2026");
    expect(date?.toISOString().slice(0, 10)).toBe("2026-08-15");
  });

  it("parsea DD-MM-YYYY", () => {
    const date = parseDate("15-08-2026");
    expect(date?.toISOString().slice(0, 10)).toBe("2026-08-15");
  });

  it("parsea DD.MM.YYYY", () => {
    const date = parseDate("15.08.2026");
    expect(date?.toISOString().slice(0, 10)).toBe("2026-08-15");
  });

  it("no acepta un dia invalido (32/13/2026)", () => {
    expect(parseDate("32/13/2026")).toBeNull();
  });

  it("devuelve null para texto vacio o no reconocible", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("ayer")).toBeNull();
  });

  it("parsea ISO con hora incluida, formato real de Revolut (YYYY-MM-DD HH:mm:ss)", () => {
    const date = parseDate("2024-07-01 09:35:49");
    expect(date?.toISOString().slice(0, 10)).toBe("2024-07-01");
  });
});

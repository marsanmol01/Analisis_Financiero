import { buildPayCycles, daysBetween } from "./pay-cycle";

describe("pay-cycle", () => {
  describe("buildPayCycles", () => {
    it("sin ninguna fecha de nomina, no devuelve ningun ciclo", () => {
      expect(buildPayCycles([], new Date("2026-09-01"))).toEqual([]);
    });

    it("con una sola fecha de nomina, hay un unico ciclo abierto hasta ahora", () => {
      const now = new Date("2026-09-15");
      const cycles = buildPayCycles([new Date("2026-09-01")], now);

      expect(cycles).toEqual([{ start: new Date("2026-09-01"), end: now, isOpen: true }]);
    });

    it("con varias fechas, cada ciclo va de una nomina a la siguiente (exclusiva) y el ultimo queda abierto", () => {
      const now = new Date("2026-09-20");
      const cycles = buildPayCycles([new Date("2026-07-01"), new Date("2026-08-03"), new Date("2026-09-02")], now);

      expect(cycles).toEqual([
        { start: new Date("2026-07-01"), end: new Date("2026-08-03"), isOpen: false },
        { start: new Date("2026-08-03"), end: new Date("2026-09-02"), isOpen: false },
        { start: new Date("2026-09-02"), end: now, isOpen: true },
      ]);
    });

    it("una paga extra entre dos nominas no genera ningun ciclo propio (solo se le pasan fechas de Nomina)", () => {
      // Esto lo garantiza quien llama a buildPayCycles (solo debe pasarle fechas de la
      // categoria "Nomina"), pero se deja constancia aqui de la intencion: con dos nominas y
      // nada mas entre medias, sigue habiendo exactamente un ciclo cerrado.
      const now = new Date("2026-09-20");
      const cycles = buildPayCycles([new Date("2026-08-01"), new Date("2026-09-01")], now);
      expect(cycles).toHaveLength(2);
      expect(cycles[0].isOpen).toBe(false);
    });
  });

  describe("daysBetween", () => {
    it("cuenta los dias completos entre dos fechas", () => {
      expect(daysBetween(new Date("2026-09-01"), new Date("2026-09-10"))).toBe(9);
    });

    it("nunca devuelve un numero negativo aunque las fechas esten invertidas", () => {
      expect(daysBetween(new Date("2026-09-10"), new Date("2026-09-01"))).toBe(0);
    });

    it("es cero para la misma fecha", () => {
      const date = new Date("2026-09-05");
      expect(daysBetween(date, date)).toBe(0);
    });
  });
});

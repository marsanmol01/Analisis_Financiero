import { isAutoConfirmable, matchTransfers, TransferCandidate } from "./transfer-matcher";

function candidate(id: string, accountId: string, date: string, amount: number): TransferCandidate {
  return { id, accountId, date: new Date(date), amount };
}

describe("matchTransfers", () => {
  it("empareja un saliente y un entrante del mismo dia con confianza maxima, autoconfirmable", () => {
    const out = candidate("out-1", "acc-a", "2026-08-15", -1000);
    const inc = candidate("inc-1", "acc-b", "2026-08-15", 1000);

    const matches = matchTransfers([out], [inc], 3);

    expect(matches).toEqual([{ outgoingId: "out-1", incomingId: "inc-1", daysDiff: 0, confidence: 1 }]);
    expect(isAutoConfirmable(matches[0].confidence)).toBe(true);
  });

  it("la confianza decae con la distancia en dias, y deja de ser autoconfirmable cerca del limite de tolerancia", () => {
    const out = candidate("out-1", "acc-a", "2026-08-15", -500);
    const incCercano = candidate("inc-1", "acc-b", "2026-08-16", 500); // 1 dia
    const incLejano = candidate("inc-2", "acc-b", "2026-08-18", 500); // 3 dias (limite de tolerancia)

    const [cercano] = matchTransfers([out], [incCercano], 3);
    const [lejano] = matchTransfers([out], [incLejano], 3);

    expect(cercano.confidence).toBeGreaterThan(lejano.confidence);
    expect(isAutoConfirmable(lejano.confidence)).toBe(false);
  });

  it("no empareja movimientos de la misma cuenta (no es una transferencia entre cuentas distintas)", () => {
    const out = candidate("out-1", "acc-a", "2026-08-15", -1000);
    const inc = candidate("inc-1", "acc-a", "2026-08-15", 1000);

    expect(matchTransfers([out], [inc], 3)).toEqual([]);
  });

  it("no empareja si el importe absoluto no coincide", () => {
    const out = candidate("out-1", "acc-a", "2026-08-15", -1000);
    const inc = candidate("inc-1", "acc-b", "2026-08-15", 999.99);

    expect(matchTransfers([out], [inc], 3)).toEqual([]);
  });

  it("no empareja si la distancia en dias supera la tolerancia", () => {
    const out = candidate("out-1", "acc-a", "2026-08-15", -1000);
    const inc = candidate("inc-1", "acc-b", "2026-08-20", 1000); // 5 dias, tolerancia 3

    expect(matchTransfers([out], [inc], 3)).toEqual([]);
  });

  it("no reutiliza un entrante ya emparejado con otro saliente", () => {
    const out1 = candidate("out-1", "acc-a", "2026-08-15", -1000);
    const out2 = candidate("out-2", "acc-c", "2026-08-15", -1000);
    const inc = candidate("inc-1", "acc-b", "2026-08-15", 1000);

    const matches = matchTransfers([out1, out2], [inc], 3);

    expect(matches).toHaveLength(1);
  });

  it("entre varios candidatos validos, elige el de menor distancia en dias", () => {
    const out = candidate("out-1", "acc-a", "2026-08-15", -1000);
    const incLejano = candidate("inc-lejano", "acc-b", "2026-08-17", 1000);
    const incCercano = candidate("inc-cercano", "acc-c", "2026-08-16", 1000);

    const matches = matchTransfers([out], [incLejano, incCercano], 3);

    expect(matches).toHaveLength(1);
    expect(matches[0].incomingId).toBe("inc-cercano");
  });

  it("con tolerancia 0 solo empareja el mismo dia exacto", () => {
    const out = candidate("out-1", "acc-a", "2026-08-15", -1000);
    const incMismoDia = candidate("inc-1", "acc-b", "2026-08-15", 1000);
    const incOtroDia = candidate("inc-2", "acc-b", "2026-08-16", 1000);

    expect(matchTransfers([out], [incMismoDia], 0)).toHaveLength(1);
    expect(matchTransfers([out], [incOtroDia], 0)).toHaveLength(0);
  });
});

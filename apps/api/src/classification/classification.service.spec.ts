import { ClassificationService } from "./classification.service";
import { RuleSet } from "./classification.types";
import { PrismaService } from "../prisma/prisma.service";

function buildRuleSet(overrides: Partial<RuleSet> = {}): RuleSet {
  return {
    rules: [],
    aliases: [],
    merchantsById: new Map(),
    ...overrides,
  };
}

describe("ClassificationService.classify", () => {
  const service = new ClassificationService({} as unknown as PrismaService);

  it("clasifica por regla CONTAINS y tiene prioridad sobre el comercio", () => {
    const ruleSet = buildRuleSet({
      rules: [
        {
          id: "r1",
          operator: "CONTAINS",
          value: "mercadona",
          accountId: null,
          minAmount: null,
          maxAmount: null,
          categoryId: "cat-supermercado",
        },
      ],
      aliases: [{ pattern: "MERCADONA", merchantId: "merchant-1" }],
      merchantsById: new Map([["merchant-1", { id: "merchant-1", defaultCategoryId: "cat-otros" }]]),
    });

    const result = service.classify(ruleSet, {
      accountId: "acc-1",
      amount: -45.3,
      normalizedDescription: "MERCADONA 4287 SEVILLA ES",
    });

    expect(result).toEqual({
      categoryId: "cat-supermercado",
      merchantId: "merchant-1",
      source: "rule",
      confidence: 1,
    });
  });

  it("respeta la prioridad: la primera regla que casa gana", () => {
    const ruleSet = buildRuleSet({
      rules: [
        { id: "r1", operator: "CONTAINS", value: "NOMINA", accountId: null, minAmount: null, maxAmount: null, categoryId: "cat-a" },
        { id: "r2", operator: "STARTS_WITH", value: "NOMINA", accountId: null, minAmount: null, maxAmount: null, categoryId: "cat-b" },
      ],
    });

    const result = service.classify(ruleSet, {
      accountId: "acc-1",
      amount: 2500,
      normalizedDescription: "NOMINA EMPRESA SL",
    });

    expect(result.categoryId).toBe("cat-a");
  });

  it("ignora una regla si esta restringida a otra cuenta", () => {
    const ruleSet = buildRuleSet({
      rules: [
        { id: "r1", operator: "CONTAINS", value: "MERCADONA", accountId: "otra-cuenta", minAmount: null, maxAmount: null, categoryId: "cat-a" },
      ],
    });

    const result = service.classify(ruleSet, {
      accountId: "acc-1",
      amount: -10,
      normalizedDescription: "MERCADONA",
    });

    expect(result.categoryId).toBeNull();
  });

  it("ignora una regla si el importe cae fuera del rango min/max", () => {
    const ruleSet = buildRuleSet({
      rules: [
        { id: "r1", operator: "CONTAINS", value: "ALQUILER", accountId: null, minAmount: -900, maxAmount: -700, categoryId: "cat-vivienda" },
      ],
    });

    const dentro = service.classify(ruleSet, { accountId: "acc-1", amount: -800, normalizedDescription: "ALQUILER PISO" });
    const fuera = service.classify(ruleSet, { accountId: "acc-1", amount: -100, normalizedDescription: "ALQUILER PISO" });

    expect(dentro.categoryId).toBe("cat-vivienda");
    expect(fuera.categoryId).toBeNull();
  });

  it("clasifica por comercio con categoria por defecto cuando no hay regla que case", () => {
    const ruleSet = buildRuleSet({
      aliases: [{ pattern: "NETFLIX", merchantId: "merchant-netflix" }],
      merchantsById: new Map([["merchant-netflix", { id: "merchant-netflix", defaultCategoryId: "cat-suscripciones" }]]),
    });

    const result = service.classify(ruleSet, {
      accountId: "acc-1",
      amount: -12.99,
      normalizedDescription: "NETFLIX.COM",
    });

    expect(result).toEqual({
      categoryId: "cat-suscripciones",
      merchantId: "merchant-netflix",
      source: "merchant",
      confidence: 0.8,
    });
  });

  it("asigna el comercio aunque no tenga categoria por defecto, sin clasificar", () => {
    const ruleSet = buildRuleSet({
      aliases: [{ pattern: "AMAZON", merchantId: "merchant-amazon" }],
      merchantsById: new Map([["merchant-amazon", { id: "merchant-amazon", defaultCategoryId: null }]]),
    });

    const result = service.classify(ruleSet, {
      accountId: "acc-1",
      amount: -23.4,
      normalizedDescription: "AMAZON EU SARL",
    });

    expect(result).toEqual({ categoryId: null, merchantId: "merchant-amazon", source: null, confidence: null });
  });

  it("el alias mas especifico (mas largo) gana sobre uno mas generico", () => {
    const ruleSet = buildRuleSet({
      aliases: [
        { pattern: "MERCADONA", merchantId: "merchant-generico" },
        { pattern: "MERCADONA EXPRESS", merchantId: "merchant-especifico" },
      ],
      merchantsById: new Map([
        ["merchant-generico", { id: "merchant-generico", defaultCategoryId: "cat-super" }],
        ["merchant-especifico", { id: "merchant-especifico", defaultCategoryId: "cat-conveniencia" }],
      ]),
    });

    const result = service.classify(ruleSet, {
      accountId: "acc-1",
      amount: -5,
      normalizedDescription: "MERCADONA EXPRESS 123",
    });

    expect(result.merchantId).toBe("merchant-especifico");
    expect(result.categoryId).toBe("cat-conveniencia");
  });

  it("no clasifica nada si no hay reglas ni comercio que casen", () => {
    const ruleSet = buildRuleSet();
    const result = service.classify(ruleSet, {
      accountId: "acc-1",
      amount: -30,
      normalizedDescription: "COMERCIO DESCONOCIDO",
    });
    expect(result).toEqual({ categoryId: null, merchantId: null, source: null, confidence: null });
  });

  it("una regex invalida en tiempo de ejecucion no lanza excepcion, simplemente no casa", () => {
    const ruleSet = buildRuleSet({
      rules: [{ id: "r1", operator: "REGEX", value: "(", accountId: null, minAmount: null, maxAmount: null, categoryId: "cat-a" }],
    });

    const result = service.classify(ruleSet, { accountId: "acc-1", amount: -1, normalizedDescription: "X" });
    expect(result.categoryId).toBeNull();
  });
});

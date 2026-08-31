import "reflect-metadata";
import { validate } from "class-validator";
import { IsMaskedAccountIdentifier } from "./is-masked-account-identifier.validator";

class TestDto {
  @IsMaskedAccountIdentifier()
  ibanMask?: string;
}

async function validateValue(value: string): Promise<boolean> {
  const dto = new TestDto();
  dto.ibanMask = value;
  const errors = await validate(dto);
  return errors.length === 0;
}

describe("IsMaskedAccountIdentifier", () => {
  it("acepta un identificador enmascarado", async () => {
    expect(await validateValue("ES91 **** **** **** 1234")).toBe(true);
  });

  it("acepta un identificador enmascarado sin espacios", async () => {
    expect(await validateValue("ES91****1234")).toBe(true);
  });

  it("rechaza un IBAN completo sin enmascarar", async () => {
    expect(await validateValue("ES9121000418450200051332")).toBe(false);
  });

  it("rechaza un IBAN completo con espacios sin enmascarar", async () => {
    expect(await validateValue("ES91 2100 0418 4502 0005 1332")).toBe(false);
  });
});

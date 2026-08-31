import { registerDecorator, ValidationOptions } from "class-validator";

// Un IBAN completo (o numero de cuenta largo) no debe guardarse nunca aqui: solo un
// identificador enmascarado, ej. "ES91 **** **** **** 1234". Rechazamos cualquier valor
// que parezca un IBAN completo sin caracteres de mascara.
const FULL_IBAN_PATTERN = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/;

function looksLikeFullIban(value: string): boolean {
  const compact = value.replace(/\s/g, "").toUpperCase();
  return FULL_IBAN_PATTERN.test(compact);
}

export function IsMaskedAccountIdentifier(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isMaskedAccountIdentifier",
      target: object.constructor,
      propertyName,
      options: {
        message:
          "El identificador de cuenta debe estar enmascarado (ej. ES91 **** **** **** 1234), no un IBAN completo",
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== "string") return false;
          return !looksLikeFullIban(value);
        },
      },
    });
  };
}

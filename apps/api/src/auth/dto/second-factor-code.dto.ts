import { IsString, Matches } from "class-validator";

// Admite tanto un codigo TOTP (6 digitos) como un codigo de recuperacion (formato
// XXXXX-XXXXX, con o sin guion): el formato exacto se distingue y valida en el servicio.
export class SecondFactorCodeDto {
  @IsString()
  @Matches(/^[0-9A-Za-z-]{6,20}$/, { message: "Código con formato inválido" })
  code!: string;
}

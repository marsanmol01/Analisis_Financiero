import { IsString, Matches } from "class-validator";

export class DisableTotpDto {
  @IsString()
  password!: string;

  // Codigo TOTP o de recuperacion, igual que SecondFactorCodeDto: si se ha perdido el
  // dispositivo, un codigo de recuperacion debe bastar tambien para desactivar el 2FA.
  @IsString()
  @Matches(/^[0-9A-Za-z-]{6,20}$/, { message: "Código con formato inválido" })
  code!: string;
}

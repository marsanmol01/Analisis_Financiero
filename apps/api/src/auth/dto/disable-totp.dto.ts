import { IsString, Matches } from "class-validator";

export class DisableTotpDto {
  @IsString()
  password!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: "El código debe tener 6 dígitos" })
  code!: string;
}

import { IsString, Matches } from "class-validator";

export class TotpCodeDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: "El código debe tener 6 dígitos" })
  code!: string;
}

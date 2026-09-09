import { IsString } from "class-validator";

export class RegenerateRecoveryCodesDto {
  @IsString()
  password!: string;
}

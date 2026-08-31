import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateMerchantAliasDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  pattern!: string;
}

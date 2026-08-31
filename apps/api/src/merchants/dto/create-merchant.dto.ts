import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateMerchantDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsUUID()
  defaultCategoryId?: string;
}

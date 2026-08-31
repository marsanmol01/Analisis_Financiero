import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateCategoryDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

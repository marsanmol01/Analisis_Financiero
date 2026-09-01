import { IsBoolean, IsOptional, IsUUID } from "class-validator";

export class UpdateRecurringDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

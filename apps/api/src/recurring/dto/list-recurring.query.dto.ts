import { IsBoolean, IsOptional, IsUUID } from "class-validator";
import { Type } from "class-transformer";

export class ListRecurringQueryDto {
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

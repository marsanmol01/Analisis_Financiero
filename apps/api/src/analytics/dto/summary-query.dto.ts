import { Type } from "class-transformer";
import { IsInt, IsOptional, IsUUID, Matches, Max, Min } from "class-validator";

export class SummaryQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "month debe tener formato YYYY-MM" })
  month?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  compareMonths?: number;
}

import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class DashboardQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  evolutionMonths?: number;
}

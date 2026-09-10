import { IsNumber, IsOptional, Max, Min } from "class-validator";

export class UpdateUserSettingsDto {
  // null borra el objetivo (deja de compararse en los consejos del dashboard).
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  monthlySavingsTarget?: number | null;
}

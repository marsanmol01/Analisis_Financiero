import { IsBoolean, IsNumber, IsOptional, IsPositive } from "class-validator";

export class UpdateBudgetDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

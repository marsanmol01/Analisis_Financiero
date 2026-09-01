import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min, MaxLength } from "class-validator";

export class CreateSavingsGoalDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  targetAmount!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  initialAmount?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsDateString()
  targetDate!: string;

  // Si se informa, el progreso pasa a ser automatico (saldo de esta cuenta). Si se omite, el
  // progreso se rastrea a mano con currentAmount.
  @IsOptional()
  @IsUUID()
  accountId?: string;
}

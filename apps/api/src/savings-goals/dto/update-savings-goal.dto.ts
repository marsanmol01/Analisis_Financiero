import { SavingsGoalStatus } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from "class-validator";

export class UpdateSavingsGoalDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  targetAmount?: number;

  @IsOptional()
  @IsDateString()
  targetDate?: string;

  // null desvincula la cuenta (pasa a modo manual); un uuid la vincula/cambia (pasa a modo
  // automatico). Omitir el campo no cambia el vinculo actual.
  @IsOptional()
  @IsUUID()
  accountId?: string | null;

  // Solo tiene efecto si el objetivo NO esta vinculado a una cuenta (accountId null tras
  // aplicar este mismo PATCH); si esta vinculado, el servicio rechaza este campo con 400.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  currentAmount?: number;

  @IsOptional()
  @IsEnum(SavingsGoalStatus)
  status?: SavingsGoalStatus;
}

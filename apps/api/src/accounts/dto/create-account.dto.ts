import { AccountType } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsISO4217CurrencyCode,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { IsMaskedAccountIdentifier } from "../validators/is-masked-account-identifier.validator";

export class CreateAccountDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  entity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  alias?: string;

  @IsEnum(AccountType)
  type!: AccountType;

  @IsOptional()
  @IsISO4217CurrencyCode()
  currency?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  balance?: number;

  @IsOptional()
  @IsDateString()
  balanceDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  externalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(34)
  @IsMaskedAccountIdentifier()
  ibanMask?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

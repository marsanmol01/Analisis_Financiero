import { RuleField, RuleOperator } from "@prisma/client";
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateRuleDto {
  @IsOptional()
  @IsEnum(RuleField)
  field?: RuleField;

  @IsEnum(RuleOperator)
  operator!: RuleOperator;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  value!: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsNumber()
  minAmount?: number;

  @IsOptional()
  @IsNumber()
  maxAmount?: number;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

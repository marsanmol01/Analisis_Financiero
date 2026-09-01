import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class BreakdownQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;
}

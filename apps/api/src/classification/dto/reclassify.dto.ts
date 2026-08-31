import { IsOptional, IsUUID } from "class-validator";

export class ReclassifyDto {
  @IsOptional()
  @IsUUID()
  accountId?: string;
}

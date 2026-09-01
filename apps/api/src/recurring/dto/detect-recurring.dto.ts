import { IsOptional, IsUUID } from "class-validator";

export class DetectRecurringDto {
  @IsOptional()
  @IsUUID()
  accountId?: string;
}

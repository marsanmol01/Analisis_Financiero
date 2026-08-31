import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class DetectTransfersDto {
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  toleranceDays?: number;
}

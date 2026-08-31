import { InternalTransferStatus } from "@prisma/client";
import { IsEnum, IsOptional } from "class-validator";

export class ListTransfersQueryDto {
  @IsOptional()
  @IsEnum(InternalTransferStatus)
  status?: InternalTransferStatus;
}

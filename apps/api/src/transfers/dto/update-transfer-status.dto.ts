import { InternalTransferStatus } from "@prisma/client";
import { IsEnum } from "class-validator";

export class UpdateTransferStatusDto {
  @IsEnum(InternalTransferStatus)
  status!: InternalTransferStatus;
}

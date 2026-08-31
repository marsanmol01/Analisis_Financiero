import { IsOptional, IsString, IsUUID } from "class-validator";

export class PreviewImportDto {
  @IsUUID()
  accountId!: string;

  // JSON codificado como string (viene de multipart/form-data). Se valida y parsea en el servicio.
  @IsOptional()
  @IsString()
  columnMapping?: string;
}

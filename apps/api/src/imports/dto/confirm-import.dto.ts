import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class ConfirmedRowDto {
  @IsInt()
  rowNumber!: number;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsDateString()
  valueDate?: string;

  @IsNumber()
  amount!: number;

  @IsString()
  @MaxLength(3)
  currency!: string;

  @IsString()
  @MaxLength(2000)
  originalDescription!: string;

  @IsString()
  @MaxLength(2000)
  normalizedDescription!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalReference?: string;

  // Estos tres campos se aceptan pero se ignoran deliberadamente. El flujo esperado del cliente
  // es reenviar tal cual los objetos de fila que devolvio /imports/preview (que incluyen
  // status/reason/fingerprint) tras filtrarlos por status; el servidor nunca confia en ellos:
  // status/reason son solo informativos del preview, y la huella real se recalcula aqui a
  // partir del resto de campos.
  @IsOptional()
  @IsString()
  fingerprint?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ConfirmImportDto {
  @IsUUID()
  accountId!: string;

  @IsString()
  @MaxLength(255)
  filename!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConfirmedRowDto)
  rows!: ConfirmedRowDto[];
}

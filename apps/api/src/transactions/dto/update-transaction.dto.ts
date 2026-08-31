import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

// Correccion manual minima. La clasificacion automatica/reglas llegan en Fase 2; aqui solo se
// permite lo que ya tiene sentido con el modelo actual: categorizar a mano y anotar.
export class UpdateTransactionDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

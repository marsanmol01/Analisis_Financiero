import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class UpdateTransactionDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  // Solo tienen efecto si categoryId viene informado (no null): "correcciones que enseñan al
  // sistema" (requisito 4.7). No crean nada oculto: applyToSimilar solo toca transacciones que
  // no hayan sido ya categorizadas a mano, y createRule crea una regla normal, visible y
  // editable en ClassificationRulesModule.
  @IsOptional()
  @IsBoolean()
  applyToSimilar?: boolean;

  @IsOptional()
  @IsBoolean()
  createRule?: boolean;
}

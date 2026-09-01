import { IsNumber, IsOptional, IsPositive, IsUUID } from "class-validator";

export class CreateBudgetDto {
  // null/omitido = presupuesto general (todo el gasto del periodo)
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;
}

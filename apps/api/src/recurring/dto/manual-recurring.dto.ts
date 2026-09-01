import { ArrayMinSize, IsArray, IsUUID } from "class-validator";

// "Quiero también poder marcar movimientos manualmente como recurrentes" (requisito 4.10):
// el usuario elige las transacciones y se reutiliza el mismo calculo de frecuencia/importe
// que usa la deteccion automatica.
export class ManualRecurringDto {
  @IsArray()
  @ArrayMinSize(2)
  @IsUUID(4, { each: true })
  transactionIds!: string[];
}

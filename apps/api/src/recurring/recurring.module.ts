import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RecurringController } from "./recurring.controller";
import { RecurringService } from "./recurring.service";

@Module({
  imports: [AuthModule],
  controllers: [RecurringController],
  providers: [RecurringService],
  exports: [RecurringService],
})
export class RecurringModule {}

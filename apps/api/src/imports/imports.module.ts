import { Module } from "@nestjs/common";
import { AccountsModule } from "../accounts/accounts.module";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { ImportsController } from "./imports.controller";
import { ImportsService } from "./imports.service";

@Module({
  imports: [AccountsModule, AuditModule, AuthModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}

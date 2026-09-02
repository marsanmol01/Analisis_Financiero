import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CryptoModule } from "../crypto/crypto.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionAuthGuard } from "./guards/session-auth.guard";

@Module({
  imports: [AuditModule, CryptoModule],
  controllers: [AuthController],
  providers: [AuthService, SessionAuthGuard],
  exports: [AuthService, SessionAuthGuard],
})
export class AuthModule {}

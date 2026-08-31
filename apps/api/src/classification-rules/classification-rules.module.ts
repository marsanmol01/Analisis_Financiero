import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { ClassificationRulesController } from "./classification-rules.controller";
import { ClassificationRulesService } from "./classification-rules.service";

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [ClassificationRulesController],
  providers: [ClassificationRulesService],
  exports: [ClassificationRulesService],
})
export class ClassificationRulesModule {}

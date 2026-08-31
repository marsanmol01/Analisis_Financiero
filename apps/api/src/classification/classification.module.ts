import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ClassificationController } from "./classification.controller";
import { ClassificationService } from "./classification.service";

@Module({
  imports: [AuthModule],
  controllers: [ClassificationController],
  providers: [ClassificationService],
  exports: [ClassificationService],
})
export class ClassificationModule {}

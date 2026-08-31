import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CsrfHeaderGuard } from "../auth/guards/csrf-header.guard";
import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
import type { SafeUser } from "../auth/auth.service";
import { ClassificationService } from "./classification.service";
import { ReclassifyDto } from "./dto/reclassify.dto";

@Controller("classification")
@UseGuards(SessionAuthGuard)
export class ClassificationController {
  constructor(private readonly classificationService: ClassificationService) {}

  @Post("reclassify")
  @UseGuards(CsrfHeaderGuard)
  reclassify(@CurrentUser() user: SafeUser, @Body() dto: ReclassifyDto) {
    return this.classificationService.reclassify(user.id, dto.accountId);
  }
}

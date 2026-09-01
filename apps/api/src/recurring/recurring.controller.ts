import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CsrfHeaderGuard } from "../auth/guards/csrf-header.guard";
import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
import type { SafeUser } from "../auth/auth.service";
import { RecurringService } from "./recurring.service";
import { DetectRecurringDto } from "./dto/detect-recurring.dto";
import { ManualRecurringDto } from "./dto/manual-recurring.dto";
import { UpdateRecurringDto } from "./dto/update-recurring.dto";
import { ListRecurringQueryDto } from "./dto/list-recurring.query.dto";

@Controller("recurring")
@UseGuards(SessionAuthGuard)
export class RecurringController {
  constructor(private readonly recurringService: RecurringService) {}

  @Get()
  findAll(@CurrentUser() user: SafeUser, @Query() query: ListRecurringQueryDto) {
    return this.recurringService.findAll(user.id, query);
  }

  @Get(":id")
  findOne(@CurrentUser() user: SafeUser, @Param("id") id: string) {
    return this.recurringService.findOne(user.id, id);
  }

  @Post("detect")
  @UseGuards(CsrfHeaderGuard)
  detect(@CurrentUser() user: SafeUser, @Body() dto: DetectRecurringDto) {
    return this.recurringService.detect(user.id, dto);
  }

  @Post("manual")
  @UseGuards(CsrfHeaderGuard)
  createManual(@CurrentUser() user: SafeUser, @Body() dto: ManualRecurringDto) {
    return this.recurringService.createManual(user.id, dto);
  }

  @Patch(":id")
  @UseGuards(CsrfHeaderGuard)
  update(@CurrentUser() user: SafeUser, @Param("id") id: string, @Body() dto: UpdateRecurringDto) {
    return this.recurringService.update(user.id, id, dto);
  }

  @Delete(":id")
  @UseGuards(CsrfHeaderGuard)
  @HttpCode(200)
  async remove(@CurrentUser() user: SafeUser, @Param("id") id: string) {
    await this.recurringService.remove(user.id, id);
    return { success: true };
  }
}

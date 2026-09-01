import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CsrfHeaderGuard } from "../auth/guards/csrf-header.guard";
import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
import type { SafeUser } from "../auth/auth.service";
import { BudgetsService } from "./budgets.service";
import { CreateBudgetDto } from "./dto/create-budget.dto";
import { UpdateBudgetDto } from "./dto/update-budget.dto";
import { ProgressQueryDto } from "./dto/progress-query.dto";

@Controller("budgets")
@UseGuards(SessionAuthGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  findAll(@CurrentUser() user: SafeUser) {
    return this.budgetsService.findAll(user.id);
  }

  @Get("progress")
  getProgress(@CurrentUser() user: SafeUser, @Query() query: ProgressQueryDto) {
    return this.budgetsService.getProgress(user.id, query);
  }

  @Get(":id")
  findOne(@CurrentUser() user: SafeUser, @Param("id") id: string) {
    return this.budgetsService.findOne(user.id, id);
  }

  @Post()
  @UseGuards(CsrfHeaderGuard)
  create(@CurrentUser() user: SafeUser, @Body() dto: CreateBudgetDto) {
    return this.budgetsService.create(user.id, dto);
  }

  @Patch(":id")
  @UseGuards(CsrfHeaderGuard)
  update(@CurrentUser() user: SafeUser, @Param("id") id: string, @Body() dto: UpdateBudgetDto) {
    return this.budgetsService.update(user.id, id, dto);
  }

  @Delete(":id")
  @UseGuards(CsrfHeaderGuard)
  @HttpCode(200)
  async remove(@CurrentUser() user: SafeUser, @Param("id") id: string) {
    await this.budgetsService.remove(user.id, id);
    return { success: true };
  }
}

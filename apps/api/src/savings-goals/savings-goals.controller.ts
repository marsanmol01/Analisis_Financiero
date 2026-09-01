import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CsrfHeaderGuard } from "../auth/guards/csrf-header.guard";
import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
import type { SafeUser } from "../auth/auth.service";
import { SavingsGoalsService } from "./savings-goals.service";
import { CreateSavingsGoalDto } from "./dto/create-savings-goal.dto";
import { UpdateSavingsGoalDto } from "./dto/update-savings-goal.dto";

@Controller("savings-goals")
@UseGuards(SessionAuthGuard)
export class SavingsGoalsController {
  constructor(private readonly savingsGoalsService: SavingsGoalsService) {}

  @Get()
  findAll(@CurrentUser() user: SafeUser) {
    return this.savingsGoalsService.findAll(user.id);
  }

  @Get(":id")
  findOne(@CurrentUser() user: SafeUser, @Param("id") id: string) {
    return this.savingsGoalsService.findOne(user.id, id);
  }

  @Post()
  @UseGuards(CsrfHeaderGuard)
  create(@CurrentUser() user: SafeUser, @Body() dto: CreateSavingsGoalDto) {
    return this.savingsGoalsService.create(user.id, dto);
  }

  @Patch(":id")
  @UseGuards(CsrfHeaderGuard)
  update(@CurrentUser() user: SafeUser, @Param("id") id: string, @Body() dto: UpdateSavingsGoalDto) {
    return this.savingsGoalsService.update(user.id, id, dto);
  }

  @Delete(":id")
  @UseGuards(CsrfHeaderGuard)
  @HttpCode(200)
  async remove(@CurrentUser() user: SafeUser, @Param("id") id: string) {
    await this.savingsGoalsService.remove(user.id, id);
    return { success: true };
  }
}

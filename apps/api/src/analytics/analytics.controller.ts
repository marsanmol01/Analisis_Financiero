import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
import type { SafeUser } from "../auth/auth.service";
import { AnalyticsService } from "./analytics.service";
import { SummaryQueryDto } from "./dto/summary-query.dto";
import { MonthlyEvolutionQueryDto } from "./dto/monthly-evolution-query.dto";
import { BreakdownQueryDto } from "./dto/breakdown-query.dto";
import { TopExpensesQueryDto } from "./dto/top-expenses-query.dto";

// Modulo de solo lectura: ninguna ruta muta datos, por eso no lleva CsrfHeaderGuard ni
// auditoria (no hay nada que auditar en una consulta).
@Controller("analytics")
@UseGuards(SessionAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("summary")
  getSummary(@CurrentUser() user: SafeUser, @Query() query: SummaryQueryDto) {
    return this.analyticsService.getSummary(user.id, query);
  }

  @Get("monthly-evolution")
  getMonthlyEvolution(@CurrentUser() user: SafeUser, @Query() query: MonthlyEvolutionQueryDto) {
    return this.analyticsService.getMonthlyEvolution(user.id, query);
  }

  @Get("by-category")
  getByCategory(@CurrentUser() user: SafeUser, @Query() query: BreakdownQueryDto) {
    return this.analyticsService.getByCategory(user.id, query);
  }

  @Get("by-merchant")
  getByMerchant(@CurrentUser() user: SafeUser, @Query() query: BreakdownQueryDto) {
    return this.analyticsService.getByMerchant(user.id, query);
  }

  @Get("top-expenses")
  getTopExpenses(@CurrentUser() user: SafeUser, @Query() query: TopExpensesQueryDto) {
    return this.analyticsService.getTopExpenses(user.id, query);
  }

  @Get("net-worth")
  getNetWorth(@CurrentUser() user: SafeUser) {
    return this.analyticsService.getNetWorth(user.id);
  }
}

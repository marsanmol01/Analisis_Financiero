import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AnalyticsModule } from "../analytics/analytics.module";
import { BudgetsModule } from "../budgets/budgets.module";
import { SavingsGoalsModule } from "../savings-goals/savings-goals.module";
import { RecurringModule } from "../recurring/recurring.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [AuthModule, AnalyticsModule, BudgetsModule, SavingsGoalsModule, RecurringModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

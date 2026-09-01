import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { AccountsModule } from "./accounts/accounts.module";
import { CategoriesModule } from "./categories/categories.module";
import { TransactionsModule } from "./transactions/transactions.module";
import { ImportsModule } from "./imports/imports.module";
import { MerchantsModule } from "./merchants/merchants.module";
import { ClassificationRulesModule } from "./classification-rules/classification-rules.module";
import { ClassificationModule } from "./classification/classification.module";
import { TransfersModule } from "./transfers/transfers.module";
import { RecurringModule } from "./recurring/recurring.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { BudgetsModule } from "./budgets/budgets.module";
import { SavingsGoalsModule } from "./savings-goals/savings-goals.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 60 }],
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    ImportsModule,
    MerchantsModule,
    ClassificationRulesModule,
    ClassificationModule,
    TransfersModule,
    RecurringModule,
    AnalyticsModule,
    BudgetsModule,
    SavingsGoalsModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

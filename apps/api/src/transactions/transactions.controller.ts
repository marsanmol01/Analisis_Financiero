import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CsrfHeaderGuard } from "../auth/guards/csrf-header.guard";
import { RequestWithUser, SessionAuthGuard } from "../auth/guards/session-auth.guard";
import type { SafeUser } from "../auth/auth.service";
import { TransactionsService } from "./transactions.service";
import { ListTransactionsQueryDto } from "./dto/list-transactions.query.dto";
import { UpdateTransactionDto } from "./dto/update-transaction.dto";

@Controller("transactions")
@UseGuards(SessionAuthGuard)
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: SafeUser, @Query() query: ListTransactionsQueryDto) {
    return this.transactionsService.findAll(user.id, query);
  }

  @Get(":id")
  findOne(@CurrentUser() user: SafeUser, @Param("id") id: string) {
    return this.transactionsService.findOne(user.id, id);
  }

  @Patch(":id")
  @UseGuards(CsrfHeaderGuard)
  async update(
    @CurrentUser() user: SafeUser,
    @Param("id") id: string,
    @Body() dto: UpdateTransactionDto,
    @Req() req: RequestWithUser,
  ) {
    const transaction = await this.transactionsService.update(user.id, id, dto);
    await this.auditService.record({
      userId: user.id,
      eventType: "TRANSACTION_UPDATED",
      ip: req.ip,
      metadata: { transactionId: transaction.id },
    });
    return transaction;
  }

  @Delete(":id")
  @UseGuards(CsrfHeaderGuard)
  @HttpCode(200)
  async remove(@CurrentUser() user: SafeUser, @Param("id") id: string, @Req() req: RequestWithUser) {
    await this.transactionsService.remove(user.id, id);
    await this.auditService.record({
      userId: user.id,
      eventType: "TRANSACTION_DELETED",
      ip: req.ip,
      metadata: { transactionId: id },
    });
    return { success: true };
  }
}

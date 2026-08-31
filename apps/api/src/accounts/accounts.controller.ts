import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CsrfHeaderGuard } from "../auth/guards/csrf-header.guard";
import { RequestWithUser, SessionAuthGuard } from "../auth/guards/session-auth.guard";
import type { SafeUser } from "../auth/auth.service";
import { AccountsService } from "./accounts.service";
import { CreateAccountDto } from "./dto/create-account.dto";
import { UpdateAccountDto } from "./dto/update-account.dto";

@Controller("accounts")
@UseGuards(SessionAuthGuard)
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: SafeUser) {
    return this.accountsService.findAll(user.id);
  }

  @Get(":id")
  findOne(@CurrentUser() user: SafeUser, @Param("id") id: string) {
    return this.accountsService.findOne(user.id, id);
  }

  @Post()
  @UseGuards(CsrfHeaderGuard)
  async create(@CurrentUser() user: SafeUser, @Body() dto: CreateAccountDto, @Req() req: RequestWithUser) {
    const account = await this.accountsService.create(user.id, dto);
    await this.auditService.record({
      userId: user.id,
      eventType: "ACCOUNT_CREATED",
      ip: req.ip,
      metadata: { accountId: account.id },
    });
    return account;
  }

  @Patch(":id")
  @UseGuards(CsrfHeaderGuard)
  async update(
    @CurrentUser() user: SafeUser,
    @Param("id") id: string,
    @Body() dto: UpdateAccountDto,
    @Req() req: RequestWithUser,
  ) {
    const account = await this.accountsService.update(user.id, id, dto);
    await this.auditService.record({
      userId: user.id,
      eventType: "ACCOUNT_UPDATED",
      ip: req.ip,
      metadata: { accountId: account.id },
    });
    return account;
  }

  @Delete(":id")
  @UseGuards(CsrfHeaderGuard)
  @HttpCode(200)
  async remove(@CurrentUser() user: SafeUser, @Param("id") id: string, @Req() req: RequestWithUser) {
    await this.accountsService.remove(user.id, id);
    await this.auditService.record({
      userId: user.id,
      eventType: "ACCOUNT_DELETED",
      ip: req.ip,
      metadata: { accountId: id },
    });
    return { success: true };
  }
}

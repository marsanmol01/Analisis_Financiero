import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CsrfHeaderGuard } from "../auth/guards/csrf-header.guard";
import { RequestWithUser, SessionAuthGuard } from "../auth/guards/session-auth.guard";
import type { SafeUser } from "../auth/auth.service";
import { TransfersService } from "./transfers.service";
import { DetectTransfersDto } from "./dto/detect-transfers.dto";
import { ListTransfersQueryDto } from "./dto/list-transfers.query.dto";
import { UpdateTransferStatusDto } from "./dto/update-transfer-status.dto";

@Controller("transfers")
@UseGuards(SessionAuthGuard)
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  findAll(@CurrentUser() user: SafeUser, @Query() query: ListTransfersQueryDto) {
    return this.transfersService.list(user.id, query.status);
  }

  @Get(":id")
  findOne(@CurrentUser() user: SafeUser, @Param("id") id: string) {
    return this.transfersService.findOne(user.id, id);
  }

  @Post("detect")
  @UseGuards(CsrfHeaderGuard)
  detect(@CurrentUser() user: SafeUser, @Body() dto: DetectTransfersDto, @Req() req: RequestWithUser) {
    return this.transfersService.detect(user.id, dto, req.ip);
  }

  @Patch(":id")
  @UseGuards(CsrfHeaderGuard)
  update(
    @CurrentUser() user: SafeUser,
    @Param("id") id: string,
    @Body() dto: UpdateTransferStatusDto,
    @Req() req: RequestWithUser,
  ) {
    return this.transfersService.updateStatus(user.id, id, dto.status, req.ip);
  }
}

import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CsrfHeaderGuard } from "../auth/guards/csrf-header.guard";
import { RequestWithUser, SessionAuthGuard } from "../auth/guards/session-auth.guard";
import type { SafeUser } from "../auth/auth.service";
import { ClassificationRulesService } from "./classification-rules.service";
import { CreateRuleDto } from "./dto/create-rule.dto";
import { UpdateRuleDto } from "./dto/update-rule.dto";

@Controller("classification-rules")
@UseGuards(SessionAuthGuard)
export class ClassificationRulesController {
  constructor(private readonly rulesService: ClassificationRulesService) {}

  @Get()
  findAll(@CurrentUser() user: SafeUser) {
    return this.rulesService.findAll(user.id);
  }

  @Get(":id")
  findOne(@CurrentUser() user: SafeUser, @Param("id") id: string) {
    return this.rulesService.findOne(user.id, id);
  }

  @Post()
  @UseGuards(CsrfHeaderGuard)
  create(@CurrentUser() user: SafeUser, @Body() dto: CreateRuleDto, @Req() req: RequestWithUser) {
    return this.rulesService.create(user.id, dto, { ip: req.ip });
  }

  @Patch(":id")
  @UseGuards(CsrfHeaderGuard)
  update(
    @CurrentUser() user: SafeUser,
    @Param("id") id: string,
    @Body() dto: UpdateRuleDto,
    @Req() req: RequestWithUser,
  ) {
    return this.rulesService.update(user.id, id, dto, req.ip);
  }

  @Delete(":id")
  @UseGuards(CsrfHeaderGuard)
  @HttpCode(200)
  async remove(@CurrentUser() user: SafeUser, @Param("id") id: string, @Req() req: RequestWithUser) {
    await this.rulesService.remove(user.id, id, req.ip);
    return { success: true };
  }
}

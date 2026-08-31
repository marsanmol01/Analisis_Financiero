import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CsrfHeaderGuard } from "../auth/guards/csrf-header.guard";
import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
import type { SafeUser } from "../auth/auth.service";
import { MerchantsService } from "./merchants.service";
import { CreateMerchantDto } from "./dto/create-merchant.dto";
import { UpdateMerchantDto } from "./dto/update-merchant.dto";
import { CreateMerchantAliasDto } from "./dto/create-merchant-alias.dto";

@Controller("merchants")
@UseGuards(SessionAuthGuard)
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Get()
  findAll(@CurrentUser() user: SafeUser) {
    return this.merchantsService.findAll(user.id);
  }

  @Get(":id")
  findOne(@CurrentUser() user: SafeUser, @Param("id") id: string) {
    return this.merchantsService.findOne(user.id, id);
  }

  @Post()
  @UseGuards(CsrfHeaderGuard)
  create(@CurrentUser() user: SafeUser, @Body() dto: CreateMerchantDto) {
    return this.merchantsService.create(user.id, dto);
  }

  @Patch(":id")
  @UseGuards(CsrfHeaderGuard)
  update(@CurrentUser() user: SafeUser, @Param("id") id: string, @Body() dto: UpdateMerchantDto) {
    return this.merchantsService.update(user.id, id, dto);
  }

  @Delete(":id")
  @UseGuards(CsrfHeaderGuard)
  @HttpCode(200)
  async remove(@CurrentUser() user: SafeUser, @Param("id") id: string) {
    await this.merchantsService.remove(user.id, id);
    return { success: true };
  }

  @Post(":id/aliases")
  @UseGuards(CsrfHeaderGuard)
  addAlias(@CurrentUser() user: SafeUser, @Param("id") id: string, @Body() dto: CreateMerchantAliasDto) {
    return this.merchantsService.addAlias(user.id, id, dto);
  }

  @Delete(":id/aliases/:aliasId")
  @UseGuards(CsrfHeaderGuard)
  @HttpCode(200)
  async removeAlias(@CurrentUser() user: SafeUser, @Param("id") id: string, @Param("aliasId") aliasId: string) {
    await this.merchantsService.removeAlias(user.id, id, aliasId);
    return { success: true };
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AuditService } from "../audit/audit.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CsrfHeaderGuard } from "../auth/guards/csrf-header.guard";
import { RequestWithUser, SessionAuthGuard } from "../auth/guards/session-auth.guard";
import type { SafeUser } from "../auth/auth.service";
import { ImportsService, UploadedFileLike } from "./imports.service";
import { PreviewImportDto } from "./dto/preview-import.dto";
import { ConfirmImportDto } from "./dto/confirm-import.dto";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

@Controller("imports")
@UseGuards(SessionAuthGuard)
export class ImportsController {
  constructor(
    private readonly importsService: ImportsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: SafeUser) {
    return this.importsService.findAll(user.id);
  }

  @Post("preview")
  @UseGuards(CsrfHeaderGuard)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  async preview(
    @CurrentUser() user: SafeUser,
    @Body() dto: PreviewImportDto,
    @UploadedFile() file: UploadedFileLike | undefined,
  ) {
    if (!file) {
      throw new BadRequestException("No se ha recibido ningún fichero");
    }
    return this.importsService.preview(user.id, dto.accountId, file, dto.columnMapping);
  }

  @Post("confirm")
  @UseGuards(CsrfHeaderGuard)
  async confirm(@CurrentUser() user: SafeUser, @Body() dto: ConfirmImportDto, @Req() req: RequestWithUser) {
    const importRecord = await this.importsService.confirm(user.id, dto);
    await this.auditService.record({
      userId: user.id,
      eventType: "IMPORT_CREATED",
      ip: req.ip,
      metadata: {
        importId: importRecord.id,
        accountId: importRecord.accountId,
        importedCount: importRecord.importedCount,
        duplicateCount: importRecord.duplicateCount,
      },
    });
    return importRecord;
  }
}

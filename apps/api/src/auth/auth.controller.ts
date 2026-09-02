import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { AuditService } from "../audit/audit.service";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { TotpCodeDto } from "./dto/totp-code.dto";
import { DisableTotpDto } from "./dto/disable-totp.dto";
import { CurrentUser } from "./decorators/current-user.decorator";
import { SessionAuthGuard, RequestWithUser } from "./guards/session-auth.guard";
import { CsrfHeaderGuard } from "./guards/csrf-header.guard";
import type { SafeUser } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  @Post("register")
  @UseGuards(CsrfHeaderGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto, @Req() request: RequestWithUser) {
    const user = await this.authService.register(dto);
    await this.auditService.record({
      userId: user.id,
      eventType: "REGISTER",
      ip: request.ip,
    });
    return user;
  }

  @Post("login")
  @UseGuards(CsrfHeaderGuard)
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Req() request: RequestWithUser) {
    const outcome = await this.authService.attemptLogin(dto.email, dto.password);

    if (outcome.status === "locked") {
      await this.auditService.record({
        eventType: "LOGIN_LOCKED",
        ip: request.ip,
        metadata: { email: dto.email },
      });
      throw new ForbiddenException("Cuenta bloqueada temporalmente por demasiados intentos fallidos");
    }

    if (outcome.status === "invalid_credentials") {
      await this.auditService.record({
        eventType: "LOGIN_FAILURE",
        ip: request.ip,
        metadata: { email: dto.email },
      });
      throw new UnauthorizedException("Credenciales inválidas");
    }

    if (outcome.status === "totp_required") {
      // La contraseña es correcta, pero la sesion NO se autentica todavia (SessionAuthGuard
      // sigue exigiendo `userId`, no `pendingTotpUserId`): solo queda "a medio camino" hasta
      // que /auth/2fa/verify-login confirme el segundo factor.
      await this.regenerateSession(request);
      request.session.pendingTotpUserId = outcome.userId;
      return { status: "totp_required" as const };
    }

    await this.regenerateSession(request);
    request.session.userId = outcome.user.id;

    await this.auditService.record({
      userId: outcome.user.id,
      eventType: "LOGIN_SUCCESS",
      ip: request.ip,
    });

    return { status: "success" as const, user: outcome.user };
  }

  @Post("2fa/verify-login")
  @UseGuards(CsrfHeaderGuard)
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyTotpLogin(@Body() dto: TotpCodeDto, @Req() request: RequestWithUser) {
    const userId = request.session.pendingTotpUserId;
    if (!userId) {
      throw new UnauthorizedException("No hay una verificación en dos pasos pendiente");
    }

    const outcome = await this.authService.verifyTotpLogin(userId, dto.code);

    if (outcome.status === "locked") {
      await this.auditService.record({
        userId,
        eventType: "LOGIN_LOCKED",
        ip: request.ip,
      });
      throw new ForbiddenException("Cuenta bloqueada temporalmente por demasiados intentos fallidos");
    }

    if (outcome.status !== "success") {
      await this.auditService.record({
        userId,
        eventType: "LOGIN_FAILURE",
        ip: request.ip,
        metadata: { reason: "totp" },
      });
      throw new UnauthorizedException("Código incorrecto");
    }

    // `regenerate` limpia tambien pendingTotpUserId: no hace falta borrarlo a mano.
    await this.regenerateSession(request);
    request.session.userId = outcome.user.id;

    await this.auditService.record({
      userId: outcome.user.id,
      eventType: "LOGIN_SUCCESS",
      ip: request.ip,
    });

    return outcome.user;
  }

  @Post("2fa/setup")
  @UseGuards(SessionAuthGuard, CsrfHeaderGuard)
  setupTotp(@CurrentUser() user: SafeUser) {
    return this.authService.setupTotp(user.id);
  }

  @Post("2fa/enable")
  @UseGuards(SessionAuthGuard, CsrfHeaderGuard)
  async enableTotp(@CurrentUser() user: SafeUser, @Body() dto: TotpCodeDto, @Req() request: RequestWithUser) {
    const updated = await this.authService.enableTotp(user.id, dto.code);
    await this.auditService.record({ userId: user.id, eventType: "TOTP_ENABLED", ip: request.ip });
    return updated;
  }

  @Post("2fa/disable")
  @UseGuards(SessionAuthGuard, CsrfHeaderGuard)
  @HttpCode(200)
  async disableTotp(@CurrentUser() user: SafeUser, @Body() dto: DisableTotpDto, @Req() request: RequestWithUser) {
    const updated = await this.authService.disableTotp(user.id, dto.password, dto.code);
    await this.auditService.record({ userId: user.id, eventType: "TOTP_DISABLED", ip: request.ip });
    return updated;
  }

  @Post("logout")
  @UseGuards(SessionAuthGuard, CsrfHeaderGuard)
  @HttpCode(200)
  async logout(
    @CurrentUser() user: SafeUser,
    @Req() request: RequestWithUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auditService.record({ userId: user.id, eventType: "LOGOUT", ip: request.ip });

    await new Promise<void>((resolve, reject) => {
      request.session.destroy((error) => (error ? reject(error) : resolve()));
    });
    response.clearCookie("pf.sid");

    return { success: true };
  }

  @Get("me")
  @UseGuards(SessionAuthGuard)
  me(@CurrentUser() user: SafeUser) {
    return user;
  }

  private regenerateSession(request: RequestWithUser): Promise<void> {
    return new Promise((resolve, reject) => {
      request.session.regenerate((error) => (error ? reject(error) : resolve()));
    });
  }
}

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

    await this.regenerateSession(request);
    request.session.userId = outcome.user.id;

    await this.auditService.record({
      userId: outcome.user.id,
      eventType: "LOGIN_SUCCESS",
      ip: request.ip,
    });

    return outcome.user;
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

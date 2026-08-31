import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { AuthService, SafeUser } from "../auth.service";

export interface RequestWithUser extends Request {
  user?: SafeUser;
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.session?.userId;

    if (!userId) {
      throw new UnauthorizedException("No hay una sesión activa");
    }

    const user = await this.authService.findSafeUserById(userId);
    if (!user) {
      throw new UnauthorizedException("La sesión ya no es válida");
    }

    request.user = user;
    return true;
  }
}

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";

// Mitigacion ligera de CSRF para peticiones que cambian estado sobre sesiones basadas en cookie:
// una peticion cross-site "simple" (form POST, <img>, etc.) no puede fijar esta cabecera custom
// sin disparar preflight CORS, que ya restringimos por origen en main.ts. Cuando existan mas
// endpoints mutantes fuera de auth, este guard debe pasar a aplicarse globalmente.
@Injectable()
export class CsrfHeaderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.header("x-requested-with");

    if (header !== "XMLHttpRequest") {
      throw new ForbiddenException("Cabecera requerida ausente");
    }
    return true;
  }
}

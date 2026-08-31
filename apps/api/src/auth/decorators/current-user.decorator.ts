import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { RequestWithUser } from "../guards/session-auth.guard";

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithUser>();
  return request.user;
});

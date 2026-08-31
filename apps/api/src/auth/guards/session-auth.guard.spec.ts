import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { SessionAuthGuard } from "./session-auth.guard";
import { AuthService } from "../auth.service";

function createContext(session: Record<string, unknown> | undefined): ExecutionContext {
  const request = { session };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("SessionAuthGuard", () => {
  it("rechaza la petición si no hay sesión con userId", async () => {
    const authService = { findSafeUserById: jest.fn() } as unknown as AuthService;
    const guard = new SessionAuthGuard(authService);

    await expect(guard.canActivate(createContext({}))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authService.findSafeUserById).not.toHaveBeenCalled();
  });

  it("rechaza la petición si el userId de sesión ya no corresponde a un usuario existente", async () => {
    const authService = { findSafeUserById: jest.fn().mockResolvedValue(null) } as unknown as AuthService;
    const guard = new SessionAuthGuard(authService);

    await expect(guard.canActivate(createContext({ userId: "user-1" }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("permite el acceso y adjunta el usuario a la petición cuando la sesión es válida", async () => {
    const user = { id: "user-1", email: "a@example.com" };
    const authService = { findSafeUserById: jest.fn().mockResolvedValue(user) } as unknown as AuthService;
    const guard = new SessionAuthGuard(authService);
    const context = createContext({ userId: "user-1" });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect((context.switchToHttp().getRequest() as { user?: unknown }).user).toEqual(user);
  });
});

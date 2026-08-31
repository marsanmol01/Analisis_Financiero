import { ConflictException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";

export interface SafeUser {
  id: string;
  email: string;
}

export type LoginOutcome =
  | { status: "success"; user: SafeUser }
  | { status: "invalid_credentials" }
  | { status: "locked"; lockedUntil: Date };

@Injectable()
export class AuthService {
  private readonly maxFailedAttempts: number;
  private readonly lockoutMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.maxFailedAttempts = Number(this.config.get("AUTH_MAX_FAILED_ATTEMPTS") ?? 5);
    this.lockoutMinutes = Number(this.config.get("AUTH_LOCKOUT_MINUTES") ?? 15);
  }

  async register(dto: RegisterDto): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("Ya existe una cuenta con ese email");
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash },
    });

    return { id: user.id, email: user.email };
  }

  async attemptLogin(email: string, password: string): Promise<LoginOutcome> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // No revelar si el email existe o no: mismo resultado en ambos casos.
    if (!user) {
      // Coste temporal similar al de una verificación real, para no filtrar por timing.
      await argon2.hash(password, { type: argon2.argon2id });
      return { status: "invalid_credentials" };
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return { status: "locked", lockedUntil: user.lockedUntil };
    }

    const passwordValid = await argon2.verify(user.passwordHash, password);

    if (!passwordValid) {
      const failedLoginCount = user.failedLoginCount + 1;
      const shouldLock = failedLoginCount >= this.maxFailedAttempts;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount,
          lockedUntil: shouldLock
            ? new Date(Date.now() + this.lockoutMinutes * 60_000)
            : null,
        },
      });

      if (shouldLock) {
        return {
          status: "locked",
          lockedUntil: new Date(Date.now() + this.lockoutMinutes * 60_000),
        };
      }
      return { status: "invalid_credentials" };
    }

    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    }

    return { status: "success", user: { id: user.id, email: user.email } };
  }

  async findSafeUserById(id: string): Promise<SafeUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? { id: user.id, email: user.email } : null;
  }
}

import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import * as QRCode from "qrcode";
import { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EncryptionService } from "../crypto/encryption.service";
import { RegisterDto } from "./dto/register.dto";
import { buildOtpAuthUrl, generateTotpSecret, verifyTotpCode } from "./totp";

export interface SafeUser {
  id: string;
  email: string;
  totpEnabled: boolean;
}

export interface TotpSetupResult {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export type LoginOutcome =
  | { status: "success"; user: SafeUser }
  | { status: "totp_required"; userId: string }
  | { status: "invalid_credentials" }
  | { status: "locked"; lockedUntil: Date };

@Injectable()
export class AuthService {
  private readonly maxFailedAttempts: number;
  private readonly lockoutMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly encryption: EncryptionService,
  ) {
    this.maxFailedAttempts = Number(this.config.get("AUTH_MAX_FAILED_ATTEMPTS") ?? 5);
    this.lockoutMinutes = Number(this.config.get("AUTH_LOCKOUT_MINUTES") ?? 15);
  }

  private toSafeUser(user: User): SafeUser {
    return { id: user.id, email: user.email, totpEnabled: user.totpEnabled };
  }

  // Compartido entre el fallo de contraseña y el fallo de codigo TOTP: para el contador de
  // fuerza bruta, "esta contraseña era incorrecta" y "este codigo era incorrecto" cuentan igual
  // — ambos son un intento de login fallido sobre la misma cuenta.
  private async registerFailedAttempt(user: User): Promise<LoginOutcome> {
    const failedLoginCount = user.failedLoginCount + 1;
    const shouldLock = failedLoginCount >= this.maxFailedAttempts;
    const lockedUntil = shouldLock ? new Date(Date.now() + this.lockoutMinutes * 60_000) : null;

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount, lockedUntil },
    });

    if (shouldLock) {
      return { status: "locked", lockedUntil: lockedUntil! };
    }
    return { status: "invalid_credentials" };
  }

  // Solo se limpia el contador cuando el login se completa de verdad (con TOTP si aplica): no
  // basta con acertar la contraseña si a continuacion se falla el segundo factor repetidamente.
  private async clearFailedAttempts(user: User): Promise<void> {
    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    }
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

    return this.toSafeUser(user);
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
      return this.registerFailedAttempt(user);
    }

    if (user.totpEnabled) {
      // Login en dos pasos: la contraseña es correcta pero todavia falta el codigo. No se
      // limpia el contador de intentos fallidos aqui — solo cuando el login termina de verdad.
      return { status: "totp_required", userId: user.id };
    }

    await this.clearFailedAttempts(user);
    return { status: "success", user: this.toSafeUser(user) };
  }

  async verifyTotpLogin(userId: string, code: string): Promise<LoginOutcome> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpEnabled || !user.totpSecretEncrypted) {
      return { status: "invalid_credentials" };
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return { status: "locked", lockedUntil: user.lockedUntil };
    }

    const secret = this.encryption.decrypt(user.totpSecretEncrypted);
    const valid = await verifyTotpCode(secret, code);
    if (!valid) {
      return this.registerFailedAttempt(user);
    }

    await this.clearFailedAttempts(user);
    return { status: "success", user: this.toSafeUser(user) };
  }

  // Genera y guarda un secreto nuevo (todavia sin activar: totpEnabled sigue en false hasta
  // que enableTotp confirme que el usuario lo escaneo correctamente). Repetir la llamada
  // sustituye el secreto anterior, invalidando una configuracion a medias abandonada.
  async setupTotp(userId: string): Promise<TotpSetupResult> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = generateTotpSecret();
    const otpauthUrl = buildOtpAuthUrl(user.email, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecretEncrypted: this.encryption.encrypt(secret) },
    });

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  async enableTotp(userId: string, code: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpSecretEncrypted) {
      throw new BadRequestException("Primero debes iniciar la configuración de la verificación en dos pasos");
    }

    const secret = this.encryption.decrypt(user.totpSecretEncrypted);
    const valid = await verifyTotpCode(secret, code);
    if (!valid) {
      throw new UnauthorizedException("Código incorrecto");
    }

    const updated = await this.prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });
    return this.toSafeUser(updated);
  }

  async disableTotp(userId: string, password: string, code: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const passwordValid = await argon2.verify(user.passwordHash, password);
    if (!passwordValid) {
      throw new UnauthorizedException("Contraseña incorrecta");
    }
    if (!user.totpEnabled || !user.totpSecretEncrypted) {
      throw new BadRequestException("La verificación en dos pasos no está activada");
    }

    const secret = this.encryption.decrypt(user.totpSecretEncrypted);
    const valid = await verifyTotpCode(secret, code);
    if (!valid) {
      throw new UnauthorizedException("Código incorrecto");
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecretEncrypted: null },
    });
    return this.toSafeUser(updated);
  }

  async findSafeUserById(id: string): Promise<SafeUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.toSafeUser(user) : null;
  }
}

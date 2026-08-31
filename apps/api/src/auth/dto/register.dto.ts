import { IsEmail, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12, { message: "La contraseña debe tener al menos 12 caracteres" })
  password!: string;
}

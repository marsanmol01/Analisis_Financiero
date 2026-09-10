import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const isProduction = config.get<string>("NODE_ENV") === "production";
  const webOrigins = (config.get<string>("WEB_ORIGIN") ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim());

  const sessionSecret = config.get<string>("SESSION_SECRET");
  if (!sessionSecret || sessionSecret === "changeme-generate-a-long-random-value") {
    throw new Error(
      "SESSION_SECRET no esta configurado o usa el valor de ejemplo. Genera uno con: openssl rand -base64 48",
    );
  }

  // nginx (el contenedor "web") reenvia las peticiones del navegador a la API dentro de la red
  // de Docker — sin esto, el limitador de peticiones trataria a todo el mundo (los 3
  // dispositivos del tailnet, cualquier navegador) como una unica IP compartida, la del propio
  // nginx. "uniquelocal" confia en X-Forwarded-For solo cuando la conexion inmediata viene de
  // una red privada (loopback o el rango interno de Docker), nunca de una conexion externa real.
  app.getHttpAdapter().getInstance().set("trust proxy", "uniquelocal");

  app.use(helmet());
  app.use(cookieParser());

  const PgSession = connectPgSimple(session);
  app.use(
    session({
      store: new PgSession({
        conString: config.get<string>("DATABASE_URL"),
        tableName: "session",
        // La tabla la crea la migracion de Prisma (modelo Session), no connect-pg-simple.
        createTableIfMissing: false,
      }),
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      name: "pf.sid",
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 12,
      },
    }),
  );

  app.enableCors({
    origin: webOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = config.get<number>("API_PORT") ?? 3000;
  await app.listen(port);
}

bootstrap();

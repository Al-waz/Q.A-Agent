import "./env-loader.js";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module.js";
import { ConfigService } from "./common/config/config.service.js";

async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({
    logger: false,
    bodyLimit: 1024 * 1024,
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.enableShutdownHooks();

  const port = config.env.API_PORT;
  const host = config.env.API_HOST;

  await app.listen(port, host);

  const logger = new Logger("bootstrap");
  logger.log(`API listening on http://${host}:${port}`);
  logger.log(`Environment: ${config.env.NODE_ENV}`);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Fatal bootstrap error", error);
  process.exit(1);
});

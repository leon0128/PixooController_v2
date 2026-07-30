import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { MillisecondConsoleLogger } from './common/logger/millisecond-console.logger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new MillisecondConsoleLogger(),
  });
  app.setGlobalPrefix('api');

  // A frame of PicData is 16 KB of Base64 and a scene may carry up to 60 of them,
  // which the default 100 KB body limit would reject long before the DTO's own cap.
  app.useBodyParser('json', { limit: '2mb' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  });
  // 0.0.0.0 so the server is reachable from outside the container.
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
bootstrap();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import 'dotenv/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );
  app.enableCors({
    origin: 'http://localhost:3000', // 允许前端访问
    credentials: true,
  });
  await app.init();
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}
void bootstrap();

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';


async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // 👈 important
  });

  app.useLogger(app.get(Logger));
  
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.listen(3000);
}
bootstrap();

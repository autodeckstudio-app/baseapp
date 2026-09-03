import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';

async function bootstrap() {
  // `rawBody: true` (Phase 2J): makes `req.rawBody` available ALONGSIDE the
  // normally-parsed `req.body` for every route — required because Razorpay
  // webhook signature verification is an HMAC over the exact raw request
  // bytes, which JSON body-parsing discards. This has no effect on any
  // other route: nothing else reads `req.rawBody`.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.useGlobalPipes(new ZodValidationPipe());
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();

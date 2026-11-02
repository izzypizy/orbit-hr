import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  console.log(`HRMS API running on http://localhost:${port}/api (mock data, resets on restart)`);
}
bootstrap();

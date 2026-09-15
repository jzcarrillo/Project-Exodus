import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow large raw uploads for cruise manifests (up to 110MB)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use(express.raw({ type: ['application/octet-stream', 'application/pdf', 'image/*', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], limit: '110mb' }));

  // Enable CORS for frontend
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('Bureau of Immigration eServices API')
    .setDescription('NestJS Backend Service for Philippine Bureau of Immigration eServices Portal')
    .setVersion('1.0.0')
    .addTag('Portal & Applications')
    .addTag('Documents')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`\n======================================================`);
  console.log(`🚀 NestJS Backend Service running on: http://localhost:${port}`);
  console.log(`📚 Swagger API Documentation on:      http://localhost:${port}/api/docs`);
  console.log(`======================================================\n`);
}
bootstrap();

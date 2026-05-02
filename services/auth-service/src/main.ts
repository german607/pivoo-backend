import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('🚀 Starting application...');

  const app = await NestFactory.create(AppModule);

  // Prefix global
  app.setGlobalPrefix('api/v1');

  // Pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors();

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Pivoo Auth Service')
    .setDescription('Authentication and authorization API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // 🔥 IMPORTANTE: usar PORT de Railway correctamente
  const port = parseInt(process.env.PORT || '3001', 10);

  console.log('ENV PORT:', process.env.PORT);
  console.log(`Starting auth service on port ${port}...`);

  await app.listen(port, '0.0.0.0');

  console.log(`✅ Auth service running on port ${port}`);
  console.log(`🌐 Health check: /api/v1/health`);
  console.log(`📚 Swagger docs: /docs`);
}

bootstrap();
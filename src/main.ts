import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const configService = app.get(ConfigService);

  // Security and Compression
  app.use(helmet());
  // app.use(compression());

  // raw body for webhook signature verification
  // Increase payload limits for large images (base64)
  const limit = '50mb';
  app.use(
    json({
      limit,
      verify: (req: { url?: string; rawBody?: string }, res, buf) => {
        if (req.url?.includes('/webhooks/')) {
          req.rawBody = buf.toString('utf8');
        }
      },
    }),
  );
  app.use(urlencoded({ limit, extended: true }));

  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'https://mofresh.rw',
      'https://mofresh-system.vercel.app',
    ],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  app.setGlobalPrefix(configService.get<string>('API_PREFIX', 'api/v1'));

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('MoFresh API')
    .setDescription('MoFresh Backend API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Railway Port Binding
  // Railway injects a dynamic PORT; we must listen on 0.0.0.0
  const port = process.env.PORT || configService.get<number>('PORT') || 3000;

  await app.listen(port, '0.0.0.0');

  logger.log(`Application is running on: http://localhost:${port}/api/v1`);
  logger.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}

void bootstrap();

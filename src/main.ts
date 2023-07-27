import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'dotenv/config';
import { LogLevel } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as expressBasicAuth from 'express-basic-auth';
import { AllExceptionFilter } from './common/exception/exception.filter';
import { ValidationPipe } from './common/validation/validation.pipe';
import { LoggingInterceptor } from './common/interceptor/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: process.env.LOG_LEVEL.split(',') as LogLevel[],
  });
  switch (process.env.NODE_ENV) {
    case 'dev':
      //app.enableCors({ origin: [process.env.ADMIN_SITE_URL, process.env.USER_SITE_URL] });
      app.enableCors();
      break;
    case 'prod':
      app.enableCors({ origin: [process.env.ADMIN_SITE_URL, process.env.USER_SITE_URL] });
      break;
    default:
      break;
  }


  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionFilter(httpAdapter));
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalInterceptors(new LoggingInterceptor());


  // Swagger
  if (process.env.NODE_ENV === 'dev') {
    app.use(
      ['/swagger'],
      expressBasicAuth({
        challenge: true,
        users: {
          [process.env.SWAGGER_USER]: process.env.SWAGGER_PASSWORD,
        },
      }),
    );
    const config = new DocumentBuilder()
      .setTitle('CVC-API')
      .setDescription('The marketplace API description')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('swagger', app, document);
  }

  await app.listen(process.env.PORT);
}
bootstrap();

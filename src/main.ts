import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'dotenv/config';
import { LogLevel } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as expressBasicAuth from 'express-basic-auth';
import { AllExceptionFilter } from './common/exception/exception.filter';
import { ValidationPipe } from './common/validation/validation.pipe';
import { LoggingInterceptor } from './common/interceptor/logging.interceptor';
import { EventsAdminService } from './events/events.admin.service';

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

  // Validate address
  // const web3Gateway = new Web3Gateway();
  // const address721 = await web3Gateway.getAddress721();
  // console.log(`Address 721 = ${address721}`);
  // if (address721.toLowerCase() !== process.env.CONTRACT_ERC_721.toLowerCase()) {
  //   throw new Error(`Contract address 721 wrong`);
  // }

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
      .setTitle('Brillianz-API')
      .setDescription('The marketplace API description')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('swagger', app, document);
    const eventAdminService = app.get(EventsAdminService);
    await Promise.all([
      eventAdminService.resetTimeoutEvent(),
    ]);
  }

  await app.listen(process.env.PORT);
}
bootstrap();

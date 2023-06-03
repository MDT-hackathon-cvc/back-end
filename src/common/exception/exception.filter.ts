import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AllExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    // const status = exception.getStatus();

    const errorName = exception['name'];
    if (exception instanceof HttpException) {
      this.logger.debug(`Error ${request.method} ${request.originalUrl}`);
      this.logger.debug(exception.message, exception.stack);
    }
    if (errorName === 'ValidationError') {
      response.status(400).json({
        statusCode: 400,
        message: exception['message'],
      });
    } else {
      super.catch(exception, host);
    }
  }
}

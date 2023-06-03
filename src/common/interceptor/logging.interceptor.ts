import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import BigNumber from 'bignumber.js';
import { Request, Response } from 'express';
const querystring = require('querystring');
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HttpLog');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req: Request = context.switchToHttp().getRequest();
    const res: Response = context.switchToHttp().getResponse();

    const realIp =
      req.headers['x-real-ip'] ||
      req.headers['x-forwarded-for'] ||
      req?.socket?.remoteAddress;
    // prettier-ignore
    this.logger.log(
      `${req.user ? `[${req.user['address']}]` : ''}[${realIp ? realIp : req.ip}] ${req.method} ${req.originalUrl}`,
    );
    // if (req.query && Object.keys(req.query).length > 0) {
    //   this.logger.debug('query', req.query);
    // }
    // if (req.body && Object.keys(req.body).length > 0) {
    //   this.logger.debug('req.body', req.body);
    // }

    const now = Date.now();
    return next.handle().pipe(
      tap(() => {
        // prettier-ignore
        this.logger.log(
          `${req.user ? `[${req.user['address']}]` : ''}[${realIp ? realIp : req.ip}] ${req.method} ${req.originalUrl} ${Date.now() - now}ms`,
        );
      }),
      map((value) => {
        try {
          let str = JSON.stringify(value);
          if (str.indexOf('"$numberDecimal"') > -1) {
            const matches = [...str.matchAll(/{"\$numberDecimal":"(.*?)"}/gim)];
            for (const match of matches) {
              BigNumber.config({ EXPONENTIAL_AT: 100 });
              const price = new BigNumber(match[1]);
              str = str.replace(match[0], `"${price.toString()}"`);
            }
            return JSON.parse(str);
          }
          return value;
        } catch (error) {
          return value;
        }
      }),
    );
  }
}

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpCode,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IntegrationErrorCode } from '../constants';

export interface Response<T> {
  code: number;
  message: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const statusCode = context.switchToHttp().getResponse().statusCode;
    const code = [200, 201].includes(statusCode)
      ? IntegrationErrorCode.SUCCESSFUL_CODE
      : IntegrationErrorCode.FAILED_CODE;
    return next.handle().pipe(
      map((data) => ({
        code,
        message: data?.message || 'Success',
        ...data,
      })),
    );
  }
}

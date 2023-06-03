import { HttpException } from '@nestjs/common';

export function ApiError(
  code: string | number = '',
  message?: any,
  data?: any,
) {
  return new HttpException(
    {
      code,
      message,
      data,
    },
    400,
  );
}

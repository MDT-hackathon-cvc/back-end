import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TransactionStatus } from 'src/schemas/Transaction.schema';

export class UpdateTransactionDto {
  isFromWorker? = false;

  @ApiProperty()
  @IsString()
  @IsOptional()
  hash: string;

  @ApiProperty()
  @IsEnum(TransactionStatus)
  status: TransactionStatus;

  @ApiProperty()
  @IsOptional()
  message?: string;

  // check for partner
  @ApiProperty()
  @IsOptional()
  address?: string;
}

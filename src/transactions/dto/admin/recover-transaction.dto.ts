import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ErrorCode } from 'src/common/constants';
import { Utils } from 'src/common/utils';
import { TransactionType } from 'src/schemas/Transaction.schema';

export class RecoverTransactionDto {
  @ApiProperty()
  @IsNotEmpty({ message: ErrorCode.INVALID_DATA })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty()
  @IsOptional()
  transactionId?: string;

  @ApiProperty()
  @IsString()
  nftId: string;

  @ApiProperty()
  @IsNotEmpty({ message: ErrorCode.INVALID_DATA })
  @IsString()
  faultyToken?: string;

  @ApiProperty()
  @IsNotEmpty({ message: ErrorCode.INVALID_DATA })
  @IsString()
  @Transform(({ value }) => Utils.formatAddress(value))
  recipientAddress: string;
}

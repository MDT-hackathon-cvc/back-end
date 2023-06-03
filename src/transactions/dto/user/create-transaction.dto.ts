import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { ErrorCode } from 'src/common/constants';
import { Utils } from 'src/common/utils';
import { TransactionType } from 'src/schemas/Transaction.schema';

export class CreateTransactionDto {
  @ApiProperty()
  @IsNotEmpty({ message: ErrorCode.INVALID_DATA })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty()
  @IsOptional()
  transactionId?: string;

  @ApiProperty()
  @IsOptional()
  nftId?: string;

  @ApiProperty()
  @IsNotEmpty({ message: ErrorCode.INVALID_DATA })
  @IsNumber()
  @IsOptional()
  quantity?: number;

  @ApiProperty()
  @IsNotEmpty({ message: ErrorCode.INVALID_DATA })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => Utils.formatAddress(value))
  toAddress?: string;

  @ApiProperty()
  @IsNotEmpty({ message: ErrorCode.INVALID_DATA })
  @IsMongoId()
  @IsOptional()
  eventId?: string;

  @ApiProperty()
  @IsOptional()
  referrer?: string;

  @ApiProperty()
  @IsMongoId()
  @IsOptional()
  redeemId?: string;

  @ApiProperty()
  tokenIds?: string[];

  @ApiProperty()
  depositAmount?: string;
}

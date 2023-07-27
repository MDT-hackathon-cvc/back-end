import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Utils } from 'src/common/utils';

export class CreateTransactionDto {
  @ApiProperty()
  @IsString()
  @IsOptional()
  nftId?: string;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  quantity?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  price?: number;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @Transform(({ value }) => Utils.formatAddress(value))
  fromAddress?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  transactionHash: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  status: string
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateSaleOrderDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  quantity;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  unitPrice: string;

  creatorAddress: string;
}

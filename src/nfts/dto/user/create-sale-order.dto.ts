import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateSaleOrderDto {
  @ApiProperty()
  @IsNumber()
  quantity: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  unitPrice: string;

  @ApiProperty()
  @IsNotEmpty()
  tokenId: string;

  creatorAddress: string;
}

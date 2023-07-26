import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class PutOnSaleDto {
  @ApiProperty()
  @IsNumber()
  price: number;
  
  @ApiProperty()
  @IsString()
  hashPutOnSale: string;
}

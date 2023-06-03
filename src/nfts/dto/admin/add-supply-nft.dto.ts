import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class AddSupplyNftDto {
  @ApiProperty()
  @IsNumber()
  newTotalSupply: number;
}

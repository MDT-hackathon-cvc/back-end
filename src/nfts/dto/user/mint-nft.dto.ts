import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class MintNftDto {
  @ApiProperty()
  @IsNumber()
  totalSupply: number;

  @ApiProperty()
  @IsString()
  hash: string;
}

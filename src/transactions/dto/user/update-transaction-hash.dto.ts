import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateTransactionHashDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  hash: string;
}

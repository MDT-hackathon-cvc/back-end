import { ApiProperty } from '@nestjs/swagger';
import { isEthereumAddress, IsNotEmpty } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty()
  referrer: string;
}

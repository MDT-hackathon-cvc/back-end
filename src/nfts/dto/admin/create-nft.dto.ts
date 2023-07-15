import { ApiProperty } from '@nestjs/swagger';
import { TokenStandard } from 'src/schemas/NFT.schema';
import {
  IsString,
  IsNumber,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';


class Token {
  standard: TokenStandard;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  totalSupply: number;
}

export class Ettributes {
  @ApiProperty()
  @IsString()
  trait_type: string;

  @ApiProperty()
  @IsString()
  value: string;
}

export class CreateNftDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({
    default: [
      {
        trait_type: 'Base',
        value: 'Starfish',
      },
    ]
  })
  @IsArray()
  attributes: [Ettributes];

  @ApiProperty()
  @IsString()
  ipfsUrl: string;
}

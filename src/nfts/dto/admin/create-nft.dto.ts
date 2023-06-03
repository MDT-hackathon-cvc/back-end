import { ApiProperty } from '@nestjs/swagger';
import { TokenStandard } from 'src/schemas/NFT.schema';
import {
  IsString,
  IsInt,
  IsNumber,
  IsBoolean,
  IsObject,
  IsEnum,
  IsOptional,
  validate,
  validateSync,
  Validate,
  ValidateIf,
  isObject,
  ValidateNested,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CreateSaleOrderDto } from './create-sale-order.dto';

class Token {
  standard: TokenStandard;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  totalSupply: number;
}

export class CreateNftDto {
  @ApiProperty()
  name = '';

  @ApiProperty()
  description = '';

  // @ApiProperty()
  // @Type(() => Number)
  // @IsNumber()
  // royaltyFee = 0;

  // @ApiProperty()
  // @IsObject()
  // attributes: any;

  @ApiProperty()
  @Type(() => Token)
  @IsObject()
  // @ValidateNested()
  token: Token;

  // @ApiProperty()
  // @Transform(({ value }) => value === 'true')
  // @IsBoolean()
  // isPutOnSale = false;

  // @ApiProperty()
  // @Type(() => CreateSaleOrderDto)
  // @ValidateIf((obj) => obj.isPutOnSale === true)
  // @IsObject()
  // @ValidateNested()
  // saleOrder: CreateSaleOrderDto;

  @ApiProperty()
  mediaType = '';

  imageFile: Express.Multer.File;
  // imageMedium: Express.Multer.File;
  // imageSmall: Express.Multer.File;
  mediaFile: Express.Multer.File;
  creatorAddress: string;
}

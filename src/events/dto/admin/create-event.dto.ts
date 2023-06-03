import { USDT, LIMIT_PER_TRANSACTION } from './../../../common/constants';
import { EventType } from './../../../schemas/Event.schema';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsEnum,
  MaxLength,
  IsDateString,
  IsBoolean,
  IsOptional,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

class CategoryInEvent {
  @ApiProperty()
  nftId: object;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  quantityForSale: number;

  @ApiProperty()
  unitPrice: number;

  @ApiProperty()
  currency = USDT;
}

export class CreateEventDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty()
  @IsOptional()
  description: string;

  @ApiProperty()
  @Type(() => Number)
  @Max(LIMIT_PER_TRANSACTION)
  limitPerTransaction: number;

  @ApiProperty()
  @IsDateString()
  startDate: Date;

  @ApiProperty()
  @IsDateString()
  endDate: Date;

  @ApiProperty()
  @IsEnum(EventType)
  type: string;

  @ApiProperty()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isDraft = true;

  @ApiProperty()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isPrivate = false;

  @ApiProperty()
  categoriesJson: string;

  @ApiProperty()
  whitelistJson: string;

  categories: CategoryInEvent[];
  image: Express.Multer.File;
  whitelist: Express.Multer.File;
  creatorAddress: string;
}

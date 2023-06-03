import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsOptional } from 'class-validator';
import { SearchDto } from 'src/common/search.dto';
import { Utils } from 'src/common/utils';
import { ObjectId } from 'mongoose';

export class FindPurchaseHistoryDto extends PartialType(SearchDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate: Date;

  @ApiProperty()
  sort: object;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => {
    return Utils.toObjectIds(value);
  })
  nftIds: ObjectId[];
}

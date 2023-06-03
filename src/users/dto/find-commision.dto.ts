import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsOptional } from 'class-validator';
import { ObjectId } from 'mongoose';
import { SearchDto } from 'src/common/search.dto';
import { Utils } from 'src/common/utils';

export class FindCommisionDto extends PartialType(SearchDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => {
    return Utils.toObjectIds(value);
  })
  nftIds: ObjectId[];
}

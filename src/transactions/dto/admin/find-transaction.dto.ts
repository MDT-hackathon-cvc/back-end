import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsOptional } from 'class-validator';
import { ObjectId } from 'mongoose';
import { SearchDto } from 'src/common/search.dto';
import { Utils } from 'src/common/utils';

export class FindTransactionDto extends PartialType(SearchDto) {
  @ApiProperty()
  @IsOptional()
  @IsDateString()
  startDate;

  @ApiProperty()
  @IsOptional()
  @IsDateString()
  endDate;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => {
    return Utils.toObjectIds(value);
  })
  nftIds: ObjectId[];

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Boolean)
  userReferrals: boolean;
}

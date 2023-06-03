import { Utils } from 'src/common/utils';
import { ObjectId } from 'mongoose';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { EventStatus, EventType } from './../../../schemas/Event.schema';
import { SearchDto } from 'src/common/search.dto';
export class FindEventDto extends PartialType(SearchDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(EventStatus)
  status: number;

  @ApiProperty({ required: false })
  @IsEnum(EventType)
  @IsOptional()
  type: EventType;

  @ApiProperty({ required: false })
  @IsOptional()
  startCreatedDate: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  endCreatedDate: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  startPeriodDate: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  endPeriodDate: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => {
    return Utils.toObjectIds(value);
  })
  nftIds: ObjectId[];
}

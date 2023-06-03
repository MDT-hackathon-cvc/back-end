import { Utils } from 'src/common/utils';
import { EventStatus, EventType } from './../../../schemas/Event.schema';
import { SearchDto } from 'src/common/search.dto';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { ObjectId } from 'mongoose';
import { Transform, Type } from 'class-transformer';
export class FindEventDto extends PartialType(SearchDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => {
    return Utils.toNumbers(value);
  })
  status: EventStatus[];

  @ApiProperty({ required: false })
  @IsOptional()
  type: EventType[];

  @ApiProperty({ required: false })
  @IsOptional()
  startDate: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  endDate: Date;

  @ApiProperty()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  isValidEvent = false;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => {
    return Utils.toObjectIds(value);
  })
  nftIds: ObjectId[];
}

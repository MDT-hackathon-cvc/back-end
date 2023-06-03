import { Utils } from 'src/common/utils';
import { ObjectId } from 'mongoose';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional } from 'class-validator';
import { SearchDto } from 'src/common/search.dto';

export class FindTokensCanRedeemDto extends PartialType(SearchDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  startDate: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  endDate: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => {
    return Utils.toObjectIds(value);
  })
  nftIds: ObjectId[];
}

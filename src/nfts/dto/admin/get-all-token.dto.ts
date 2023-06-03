import { Utils } from 'src/common/utils';
import { SearchDto } from 'src/common/search.dto';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { ObjectId } from 'mongoose';
import { Transform } from 'class-transformer';
import { OwnerStatus } from 'src/schemas/NFT.schema';
export class GetAllTokenDto extends PartialType(SearchDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  status: OwnerStatus;

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

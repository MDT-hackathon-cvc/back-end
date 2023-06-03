import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ObjectId } from 'mongoose';
import { SearchDto } from 'src/common/search.dto';
import { Utils } from 'src/common/utils';
import { OwnerStatus } from 'src/schemas/NFT.schema';

export class FindOwnerDto extends PartialType(SearchDto) {
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
  isBurned: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(OwnerStatus)
  status: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => Utils.toObjectIds(value))
  nftIds: ObjectId[];
}

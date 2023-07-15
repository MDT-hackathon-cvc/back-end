import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { SearchDto } from 'src/common/search.dto';
import { NFTStatus } from 'src/schemas/NFT.schema';
import { Type } from 'class-transformer';

export enum NftType {
  ALL = 0,
  WITHOUT_BLACK = 1,
  ONLY_BLACK = 2,
}

export enum OnSaleStatus {
  ALL = 0,
  ABLE = 1,
}

export class FindNftDto extends PartialType(SearchDto) {
  @ApiProperty()
  @IsOptional()
  @IsEnum(NFTStatus)
  status: string;
}

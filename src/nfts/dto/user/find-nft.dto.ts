import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsObject, IsOptional } from 'class-validator';
import { SearchDto } from 'src/common/search.dto';
import { NFTStatus } from 'src/schemas/NFT.schema';

export class FindNftDto extends PartialType(SearchDto) {
  @ApiProperty()
  @IsOptional()
  @IsEnum(NFTStatus)
  status: NFTStatus;

  @ApiProperty()
  @IsOptional()
  @IsObject()
  attributes: any;

  @ApiProperty()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isOwned = false;

  @ApiProperty()
  @IsOptional()
  currency: string;

  @ApiProperty()
  @IsOptional()
  minPrice: string;

  @ApiProperty()
  @IsOptional()
  maxPrice: string;
}

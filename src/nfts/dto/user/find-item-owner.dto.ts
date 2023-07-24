import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { SearchDto } from 'src/common/search.dto';

export class FindItemOwnerDto extends PartialType(SearchDto) {
  @ApiProperty()
  @IsOptional()
  @IsDateString()
  fromMintDate;

  @ApiProperty()
  @IsOptional()
  @IsDateString()
  toMintDate;
}

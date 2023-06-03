import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { SearchDto } from 'src/common/search.dto';
import { TokenStandard } from 'src/schemas/NFT.schema';

export class FindSaleHistoryDto extends PartialType(SearchDto) {
  @ApiProperty()
  @IsOptional()
  @IsEnum(TokenStandard)
  tokenStandard: TokenStandard;

  @ApiProperty()
  @IsOptional()
  @IsDateString()
  from;

  @ApiProperty()
  @IsOptional()
  @IsDateString()
  until;
}

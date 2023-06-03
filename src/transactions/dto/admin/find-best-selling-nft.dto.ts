import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { SearchDto } from 'src/common/search.dto';
import { TokenStandard } from 'src/schemas/NFT.schema';

export class FindBestSellingNFTDto extends PartialType(SearchDto) {
  @ApiProperty()
  @IsOptional()
  @IsEnum(TokenStandard)
  tokenStandard: TokenStandard;
}

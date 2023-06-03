import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { SearchDto } from 'src/common/search.dto';

export class FindTransactionDto extends PartialType(SearchDto) {
  @ApiProperty()
  @IsOptional()
  @IsDateString()
  from;

  @ApiProperty()
  @IsOptional()
  @IsDateString()
  until;
}

import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { SearchDto } from 'src/common/search.dto';
import {
  TransactionType,
} from 'src/schemas/Transaction.schema';

export class FindTransactionDto extends PartialType(SearchDto) {
  @ApiProperty()
  @IsOptional()
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isMyHistory = false;
}

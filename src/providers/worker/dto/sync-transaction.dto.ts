import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { TokenStandard } from 'src/schemas/NFT.schema';

export class SyncTransactionDto {
  @ApiProperty()
  @IsEnum(TokenStandard)
  type: TokenStandard;

  @ApiProperty()
  @IsOptional()
  blockNumber: number;
}

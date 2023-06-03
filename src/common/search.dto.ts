import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';

export class SearchDto {
  @ApiProperty()
  @Transform(({ value }) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')?.trim(),
  )
  keyword = '';

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit: number;

  @ApiProperty()
  sort: object;

  @ApiProperty()
  projection: object;
}

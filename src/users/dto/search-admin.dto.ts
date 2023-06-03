import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsDateString, IsArray, IsBoolean } from 'class-validator';
import { SearchDto } from 'src/common/search.dto';

export class SearchAdminDto extends PartialType(SearchDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  status: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  accessModule: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  default: boolean;
}

import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsDateString, IsEnum } from 'class-validator';
import { SearchDto } from 'src/common/search.dto';
import { KYCStatus, UserType } from 'src/schemas/User.schema';

export enum ExportType {
  HAS_EXPORT = 1,
}
export class SearchUserDto extends PartialType(SearchDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  status: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(UserType)
  userType: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(KYCStatus)
  kycStatus: number;

  @ApiProperty({ required: false })
  @IsOptional()
  equityShare: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(ExportType)
  isExport: number;
}

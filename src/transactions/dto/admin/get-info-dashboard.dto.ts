import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsDate,
} from 'class-validator';

export enum CurrencyDashboardType {
  EKO = 'eko',
  USD = 'usd',
}

export enum DataTypeDashboardType {
  VOLUME = 'volume',
  REVENUE = 'revenue',
}

export enum TimeDashboardType {
  All_TIME = 'all-time',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
}

export class DashboardDto {
  @ApiProperty()
  @IsOptional()
  currency: string;

  @ApiProperty()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  from: Date;

  @ApiProperty()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  to: Date;

  @ApiProperty()
  @IsOptional()
  @IsEnum(TimeDashboardType)
  timeType: TimeDashboardType;
}

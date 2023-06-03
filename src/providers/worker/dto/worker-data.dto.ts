import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsObject, IsString } from 'class-validator';

export class WorkerDataDto {
  @ApiProperty()
  @IsNumber()
  timeStamp: number;

  @ApiProperty()
  @IsString()
  hash: string;

  @ApiProperty()
  @IsString()
  from: string;

  @ApiProperty()
  @IsString()
  to: string;

  @ApiProperty()
  @IsString()
  contractAddress: string;

  @ApiProperty()
  @IsString()
  eventType: string;

  @ApiProperty()
  @IsObject()
  data: object;
}

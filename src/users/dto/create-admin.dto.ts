import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayNotContains,
  ArrayNotEmpty,
  IsEthereumAddress,
  IsString,
  NotEquals,
} from 'class-validator';
import { Utils } from 'src/common/utils';
import { AdminPermissions, SUPER_ADMIN_NAME } from 'src/schemas/User.schema';

export class CreateAdminDto {
  @ApiProperty()
  @IsEthereumAddress()
  @NotEquals(process.env.ADMIN_WALLET_ADDRESS)
  @Transform(({ value }) => Utils.formatAddress(value))
  address: string;

  @ApiProperty()
  @IsString()
  @NotEquals(SUPER_ADMIN_NAME)
  adminName: string;

  @ApiProperty()
  @ArrayNotEmpty()
  @ArrayNotContains([AdminPermissions.ROLE_MANAGEMENT])
  permissions: string[];
}

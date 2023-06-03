import { ApiProperty } from "@nestjs/swagger";
import { ArrayNotContains, ArrayNotEmpty, IsIn, IsOptional, IsString, NotEquals } from "class-validator";
import { AdminPermissions, SUPER_ADMIN_NAME, UserStatus } from "src/schemas/User.schema";

export class UpdateAdminDto {
  @ApiProperty()
  @IsOptional()
  @IsString()
  @NotEquals(SUPER_ADMIN_NAME)
  adminName: string;

  @ApiProperty()
  @IsOptional()
  @ArrayNotEmpty()
  @ArrayNotContains([AdminPermissions.ROLE_MANAGEMENT])
  permissions: string[];

  @ApiProperty()
  @IsOptional()
  @IsIn([UserStatus.DEACTIVE, UserStatus.ACTIVE])
  status: string;
}
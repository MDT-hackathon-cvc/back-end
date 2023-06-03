import { IsEnum, IsNotEmpty } from "class-validator";
import { TYPE_LOGIN } from "src/common/constants";

export class LoginDto {
  signature: string;

  address: string;

  referrer: string;

  @IsEnum(TYPE_LOGIN)
  @IsNotEmpty()
  type: string;
}

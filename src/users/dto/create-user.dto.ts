import { UserRole } from 'src/schemas/User.schema';

export class CreateUserDto {
  address: string;

  role: UserRole;
}

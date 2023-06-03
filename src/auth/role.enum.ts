// export enum Role {
//   User = 'user',
//   Admin = 'admin',
//   SuperAdmin = 'super-admin',
//   Worker = 'worker',
// }

import { UserRole, UserType } from 'src/schemas/User.schema';

export class UserJWT {
  address: string;
  role: UserRole;
  referrer: string;
  userType: UserType;
  originator: string;
  // userType:
}

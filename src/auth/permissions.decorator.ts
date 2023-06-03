import { SetMetadata } from '@nestjs/common';
import { AdminPermissions } from 'src/schemas/User.schema';

export const PERMISSION_KEY = 'permissions';
export const Permissions = (...permissions: AdminPermissions[]) =>
  SetMetadata(PERMISSION_KEY, permissions);

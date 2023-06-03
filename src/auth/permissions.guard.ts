import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminPermissions } from 'src/schemas/User.schema';
import { PERMISSION_KEY } from './permissions.decorator';
import { CommonService } from 'src/common-service/common.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly commonService: CommonService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // console.log('context :>> ', context['args'][0]?.method);
    const requiredPermission = this.reflector.getAllAndOverride<
      AdminPermissions[]
    >(PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredPermission) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    const [permissions, isUpdateAction] = await Promise.all([
      this.commonService.getPermissionsOfAdmin(user.address),
      this.commonService.updateStatusAdminAction(user.address),
    ]);
    return permissions.includes(requiredPermission[0]);
  }
}

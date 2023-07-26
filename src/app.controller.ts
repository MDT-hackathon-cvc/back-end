import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
// import { Role } from './auth/role.enum';
import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';
import { Utils } from './common/utils';
import { UserRole } from './schemas/User.schema';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return this.appService.getHello();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('/config')
  getConfig(@Request() req) {
    return this.appService.getConfig(req.user.address);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN, )
  @ApiBearerAuth()
  @Get('/full-config')
  getFullConfig() {
    return this.appService.getFullConfig();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Post('/config')
  updateConfig(@Body() requestData: any) {
    return this.appService.updateConfig(requestData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Post('/clear-cache')
  clearCache() {
    return this.appService.clearCache();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  // @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('admin/permissions')
  getPermissionAdmin(@Request() req) {
    return this.appService.getPermissionAdmin(req.user.address);
  }
}

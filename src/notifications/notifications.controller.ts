import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { SearchDto } from 'src/common/search.dto';
import { UserRole } from 'src/schemas/User.schema';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(UserRole.USER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SYSTEM)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@Request() req, @Query() requestData: SearchDto) {
    return this.notificationsService.findAll(requestData, req.user);
  }

  @Patch('markAsReadAll')
  markAsReadAll(@Request() req) {
    return this.notificationsService.markAsReadAll(req.user);
  }

  @Patch(':id')
  markAsRead(@Request() req, @Param('id') id: string) {
    return this.notificationsService.markAsRead(id, req.user);
  }
}

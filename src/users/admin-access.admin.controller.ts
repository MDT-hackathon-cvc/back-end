import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { UserRole } from 'src/schemas/User.schema';
import { UsersService } from './users.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { SearchAdminDto } from './dto/search-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { ValidatePermissionDto } from './dto/validate-permission.dto';

@ApiTags('admin/admin-access')
@Controller('admin/admin-access')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
export class AdminAccessController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  setAdmin(@Body() createAdminDto: CreateAdminDto) {
    return this.usersService.setAdmin(createAdminDto);
  }

  @Get()
  findAllAdmin(@Query() requestData: SearchAdminDto) {
    return this.usersService.findAllAdmin(requestData);
  }

  @Patch(':id')
  updateAdmin(@Param('id') id: string, @Body() updateAdminDto: UpdateAdminDto) {
    return this.usersService.updateAdmin(id, updateAdminDto);
  }

  @Delete(':id')
  deleteAdmin(@Param('id') id: string) {
    return this.usersService.deleteAdmin(id);
  }

  @Post('validation')
  validatePermission(@Body() data: ValidatePermissionDto) {
    return this.usersService.validatePermission(data);
  }
}

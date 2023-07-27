import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { UsersService } from './users.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'src/schemas/User.schema';
import { SearchUserDto } from './dto/search-user.dto';


@ApiTags('admin/users')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class UsersAdminController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query() requestData: SearchUserDto) {
    return this.usersService.findAll(requestData);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findUserInfoByAddressOrId({ id });
  }

  @Get('address/:address')
  findUserByAddress(@Param('address') address: string) {
    return this.usersService.findUserInfoByAddressOrId({ address });
  }
}

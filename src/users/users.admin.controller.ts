import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'src/schemas/User.schema';
import { SearchUserDto } from './dto/search-user.dto';
import { FindOwnerDto } from 'src/nfts/dto/admin/find-owner.dto';
import { FindCommisionDto } from './dto/find-commision.dto';

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

  @Get('referral/network/:id')
  findDirectReferee(
    @Param('id') id: string,
    @Query() requestData: SearchUserDto,
  ) {
    return this.usersService.findDirectReferee({ id }, requestData);
  }

  @Get('referral/network/detail/:id')
  findLineDetail(@Param('id') id: string, @Query() requestData: SearchUserDto) {
    return this.usersService.findLineDetail({ id }, requestData);
  }

  @Get('referral/network/detail/overview/:id')
  overviewLineDetail(@Param('id') id: string) {
    return this.usersService.overviewLineDetail({ id });
  }

  @Get('owned/token/:id')
  findOwnedToken(@Param('id') id: string, @Query() requestData: FindOwnerDto) {
    return this.usersService.findOwnedToken({ id }, requestData);
  }

  @Get('referral/commission/:id')
  getCommissionUser(
    @Param('id') id: string,
    @Query() requestData: FindCommisionDto,
  ) {
    return this.usersService.getCommissionUser({ id }, requestData);
  }
}

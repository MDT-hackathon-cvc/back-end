import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { EventKYC } from 'src/users/dto/kyc-user.dto';
import { UserRole } from 'src/schemas/User.schema';
import { FindCommisionDto } from './dto/find-commision.dto';
import { SearchUserDto } from './dto/search-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('/profile')
  findByAddress(@Request() req) {
    return this.usersService.findUserInfoByAddressOrId({
      address: req.user.address,
    });
  }

  @Get(':address')
  findUserInfoByAddress(@Param('address') addr: string) {
    return this.usersService.isValidReferrer({
      addr,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch()
  updateUserInfo(@Request() req, @Body() body: UpdateUserDto) {
    return this.usersService.update(req.user.address, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.USER)
  @Get('referral/network')
  findDirectReferee(@Request() req, @Query() requestData: SearchUserDto) {
    return this.usersService.findDirectReferee(
      { addr: req.user.address },
      requestData,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.USER)
  @Get('referral/network/detail/:id')
  findLineDetail(@Param('id') id: string, @Query() requestData: SearchUserDto) {
    return this.usersService.findLineDetail({ id }, requestData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.USER)
  @Get('referral/network/detail/overview/:id')
  overviewLineDetail(@Param('id') id: string) {
    return this.usersService.overviewLineDetail({ id });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.USER)
  @Get('referral/network/commision')
  findCommision(@Request() req, @Query() requestData: FindCommisionDto) {
    return this.usersService.getCommissionUser(
      { addr: req.user.address },
      requestData,
    );
  }
  @Post('/kyc')
  webhookKyc(@Body() data: EventKYC) {
    return this.usersService.submitKyc(data);
  }
}

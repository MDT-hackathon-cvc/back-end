import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
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
}

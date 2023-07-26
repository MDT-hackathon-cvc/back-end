import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { Permissions } from 'src/auth/permissions.decorator';
import { AdminPermissions, UserRole } from 'src/schemas/User.schema';
import { FindTransactionDto } from './dto/admin/find-transaction.dto';
import { RecoverTransactionDto } from './dto/admin/recover-transaction.dto';
import { TransactionsAdminService } from './transactions.admin.service';

@ApiTags('admin/transactions')
@Controller('admin/transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Permissions(AdminPermissions.REVENUE_MANAGEMENT)
export class TransactionsAdminController {
  constructor(private readonly transactionsService: TransactionsAdminService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.transactionsService.findOne(id);
  }

  @Post('/recover')
  recoverMinting(@Request() req, @Body() body: RecoverTransactionDto) {
    return this.transactionsService.createRecoverTransaction(req.user, body);
  }
}

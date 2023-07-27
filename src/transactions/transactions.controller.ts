import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/user/create-transaction.dto';
import { UpdateTransactionDto } from './dto/user/update-transaction.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FindPurchaseHistoryDto } from './dto/user/find-purchase-history.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { UpdateTransactionHashDto } from './dto/user/update-transaction-hash.dto';
import { UserRole } from 'src/schemas/User.schema';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  create(@Request() req, @Body() createTransactionDto: CreateTransactionDto) {
    return this.transactionsService.create(createTransactionDto, req.user.address);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @Get('purchase-histories')
  findPurchaseHistories(
    @Request() req,
    @Query() requestData: FindPurchaseHistoryDto,
  ) {
    return this.transactionsService.findPurchaseHistories(
      requestData,
      req.user,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.transactionsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch(':id')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(req, id, updateTransactionDto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch(':id/hash')
  updateTransactionHash(
    @Request() req,
    @Param('id') id: string,
    @Body() updateTransactionHashDto: UpdateTransactionHashDto,
  ) {
    return this.transactionsService.updateTransactionHash(
      id,
      updateTransactionHashDto,
      req.user,
    );
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
// import { Role } from 'src/auth/role.enum';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { UserRole } from 'src/schemas/User.schema';
import { SyncTransactionDto } from './dto/sync-transaction.dto';
import { WorkerDataDto } from './dto/worker-data.dto';
import { WorkerService } from './worker.service';
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('worker')
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  @Roles(UserRole.ADMIN)
  @Post('/token')
  @HttpCode(200)
  generateToken() {
    return this.workerService.generateToken();
  }

  @Roles(UserRole.ADMIN)
  @Post('/sync-transactions')
  @HttpCode(200)
  syncTransactions(@Body() requestData: SyncTransactionDto) {
    if (requestData.blockNumber) {
      return this.workerService.syncTransactionsInBlock(requestData);
    } else {
      return this.workerService.syncTransactions(requestData);
    }
  }

  @Roles(UserRole.WORKER)
  @Post()
  @HttpCode(200)
  receivedData(@Body() requestData: WorkerDataDto) {
    return this.workerService.receivedData(requestData);
  }
}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from 'src/common-service/common.module';
import { NFT, NFTSchema } from 'src/schemas/NFT.schema';
import {
  TransactionTransfer,
  TransactionTransferSchema,
} from 'src/schemas/TransactionTransfer.schema';
import { User, UserSchema } from 'src/schemas/User.schema';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { WorkerController } from './worker.controller';
import { WorkerService } from './worker.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NFT.name, schema: NFTSchema },
      { name: TransactionTransfer.name, schema: TransactionTransferSchema },
      { name: User.name, schema: UserSchema },
    ]),
    CommonModule,
    TransactionsModule,
  ],
  controllers: [WorkerController],
  providers: [WorkerService],
})
export class WorkerModule {}

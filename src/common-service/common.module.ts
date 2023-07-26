
import { MongooseModule } from '@nestjs/mongoose';
import { Config, ConfigSchema } from 'src/schemas/Config.schema';
import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { NFT, NFTSchema } from 'src/schemas/NFT.schema';
import { Transaction, TransactionSchema } from 'src/schemas/Transaction.schema';
import { Counter, CounterSchema } from 'src/schemas/Counter.schema';
import { Lock, LockSchema } from 'src/schemas/Lock.schema';
import { SocketModule } from 'src/providers/socket/socket.module';
import {
  Notification,
  NotificationSchema,
} from 'src/schemas/Notification.schema';
import { User, UserSchema } from 'src/schemas/User.schema';
import {
  TransactionTransfer,
  TransactionTransferSchema,
} from 'src/schemas/TransactionTransfer.schema';
import {
  TransactionTransferSync,
  TransactionTransferSyncSchema,
} from 'src/schemas/TransactionTransferSync.schema';
import { Owner, OwnerSchema } from 'src/schemas/Owner.schema';
import { LockHistory, LockHistorySchema } from 'src/schemas/LockHistory.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Config.name, schema: ConfigSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: Lock.name, schema: LockSchema },
      { name: NFT.name, schema: NFTSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: User.name, schema: UserSchema },
      { name: TransactionTransfer.name, schema: TransactionTransferSchema },
      {
        name: TransactionTransferSync.name,
        schema: TransactionTransferSyncSchema,
      },
      { name: Owner.name, schema: OwnerSchema },
      { name: LockHistory.name, schema: LockHistorySchema },
    ]),
    SocketModule,
  ],
  providers: [CommonService],
  exports: [CommonService],
})
export class CommonModule {}

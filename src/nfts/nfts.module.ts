import { Module } from '@nestjs/common';
import { NftsService } from './nfts.service';
import { NftsController } from './nfts.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { NFT, NFTSchema } from 'src/schemas/NFT.schema';
import { NftsAdminController } from './nfts.admin.controller';
import { Transaction, TransactionSchema } from 'src/schemas/Transaction.schema';
import { NftsAdminService } from './nfts.admin.service';
import { CommonModule } from 'src/common-service/common.module';
import {
  Notification,
  NotificationSchema,
} from 'src/schemas/Notification.schema';
import { Owner, OwnerSchema } from 'src/schemas/Owner.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NFT.name, schema: NFTSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Owner.name, schema: OwnerSchema },
    ]),
    CommonModule,
  ],
  controllers: [NftsController, NftsAdminController],
  providers: [NftsService, NftsAdminService],
  exports: [],
})
export class NftsModule {}

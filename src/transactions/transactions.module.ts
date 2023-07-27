import { User, UserSchema } from './../schemas/User.schema';
import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Transaction, TransactionSchema } from 'src/schemas/Transaction.schema';
import { TransactionsAdminService } from './transactions.admin.service';
import { NFT, NFTSchema, Owner } from 'src/schemas/NFT.schema';
import { NftsModule } from 'src/nfts/nfts.module';
import { CommonModule } from 'src/common-service/common.module';
import { OwnerSchema } from 'src/schemas/Owner.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NFT.name, schema: NFTSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: User.name, schema: UserSchema },
      { name: Owner.name, schema: OwnerSchema },
    ]),
    NftsModule,
    CommonModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionsAdminService],
  exports: [TransactionsService],
})
export class TransactionsModule {}

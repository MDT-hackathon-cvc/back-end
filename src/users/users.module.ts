import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/schemas/User.schema';
import { UsersAdminController } from './users.admin.controller';
import { CommonModule } from 'src/common-service/common.module';
import { NFT, NFTSchema } from 'src/schemas/NFT.schema';
import { Transaction, TransactionSchema } from 'src/schemas/Transaction.schema';
import { Owner, OwnerSchema } from 'src/schemas/Owner.schema';
import { AdminAccessController } from './admin-access.admin.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: NFT.name, schema: NFTSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Owner.name, schema: OwnerSchema },
    ]),
    CommonModule,
  ],
  controllers: [UsersController, UsersAdminController, AdminAccessController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

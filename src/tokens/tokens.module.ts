import { Module } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { TokensController } from './tokens.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { NFT, NFTSchema } from 'src/schemas/NFT.schema';
import { CommonModule } from 'src/common-service/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: NFT.name, schema: NFTSchema }]),
    CommonModule,
  ],
  controllers: [TokensController],
  providers: [TokensService],
})
export class TokensModule {}

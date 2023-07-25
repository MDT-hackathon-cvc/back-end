import { CommonModule } from 'src/common-service/common.module';
import { NFTSchema, NFT } from 'src/schemas/NFT.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { Module } from '@nestjs/common';
import { Event, EventSchema } from 'src/schemas/Event.schema';
import { Owner, OwnerSchema } from 'src/schemas/Owner.schema';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }]),
    MongooseModule.forFeature([{ name: NFT.name, schema: NFTSchema }]),
    MongooseModule.forFeature([{ name: Owner.name, schema: OwnerSchema }]),
    CommonModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [],
})
export class EventsModule {}

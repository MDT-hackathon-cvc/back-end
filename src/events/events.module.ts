import { CommonModule } from 'src/common-service/common.module';
import { NFTSchema, NFT } from 'src/schemas/NFT.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { EventsAdminService } from './events.admin.service';
import { EventsAdminController } from './events.admin.controller';
import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { Event, EventSchema } from 'src/schemas/Event.schema';
import { Owner, OwnerSchema } from 'src/schemas/Owner.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }]),
    MongooseModule.forFeature([{ name: NFT.name, schema: NFTSchema }]),
    MongooseModule.forFeature([{ name: Owner.name, schema: OwnerSchema }]),
    CommonModule,
  ],
  controllers: [EventsController, EventsAdminController],
  providers: [EventsService, EventsAdminService],
  exports: [],
})
export class EventsModule {}

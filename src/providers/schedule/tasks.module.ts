import { MongooseModule } from '@nestjs/mongoose';
import { Config, ConfigSchema } from 'src/schemas/Config.schema';
import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Event, EventSchema } from 'src/schemas/Event.schema';
import { CommonModule } from 'src/common-service/common.module';
import { NFT, NFTSchema } from 'src/schemas/NFT.schema';
import {
  NotificationSchema,
  Notification,
} from 'src/schemas/Notification.schema';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Config.name, schema: ConfigSchema },
      { name: NFT.name, schema: NFTSchema },
      { name: Event.name, schema: EventSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
    CommonModule,
  ],
  providers: [TasksService],
  exports: [],
})
export class TasksModule {}

import { CacheModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { NftsModule } from './nfts/nfts.module';
import { TransactionsModule } from './transactions/transactions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RedisClientOptions } from 'redis';
import * as redisStore from 'cache-manager-redis-store';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksModule } from './providers/schedule/tasks.module';
import { WorkerModule } from './providers/worker/worker.module';
import { CommonModule } from './common-service/common.module';
import { SocketModule } from './providers/socket/socket.module';
import { TokensModule } from './tokens/tokens.module';
import { Config, ConfigSchema } from './schemas/Config.schema';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CacheModule.register<RedisClientOptions>({
      // store: redisStore,
      socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.PORT),
      },
      ttl: Number(process.env.REDIS_TTL),
      isGlobal: true,
    }),
    MongooseModule.forRoot(process.env.MONGODB_URL),
    MongooseModule.forFeature([
      { name: Config.name, schema: ConfigSchema },
    ]),
    SocketModule,
    CommonModule,
    TasksModule,
    WorkerModule,
    AuthModule,
    UsersModule,
    NftsModule,
    TransactionsModule,
    NotificationsModule,
    TokensModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

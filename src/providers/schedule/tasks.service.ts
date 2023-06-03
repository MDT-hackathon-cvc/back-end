import { EventDocument, EventStatus, Event } from 'src/schemas/Event.schema';
import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import mongoose, { Model } from 'mongoose';
import { CommonService } from 'src/common-service/common.service';
import { Config, ConfigDocument } from 'src/schemas/Config.schema';
import { NFT, TokenStandard, NFTDocument } from 'src/schemas/NFT.schema';
import { CoinMarketGateway } from '../coin-market/coin-market.gateway';
import { CoinMarketType } from '../coin-market/coin-market.type';
import {
  RewardEvent,
  RewardEventDocument,
  RewardEventStatus,
} from 'src/schemas/RewardEvent.schema';
import {
  NotificationDocument,
  NotificationType,
  Notification,
} from 'src/schemas/Notification.schema';

const EVERY_2_MINUTES = '0 */2 * * * *';
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly commonService: CommonService,
    @InjectConnection() private readonly connection: mongoose.Connection,
    @InjectModel(Config.name) private configModel: Model<ConfigDocument>,
    @InjectModel(NFT.name) private nftModel: Model<NFTDocument>,
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectModel(RewardEvent.name)
    private rewardEventModel: Model<RewardEventDocument>,
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async syncCurrencyRate() {
    const config = await this.configModel.findOne();
    const coingeckoIds = [];
    const coinmarketcapIds = [];
    for (const [key, value] of Object.entries(config.currencies)) {
      coingeckoIds.push(value.coingeckoApiId);
      coinmarketcapIds.push(value.coinmarketcapApiId);
    }
    try {
      const coinGecko = new CoinMarketGateway(CoinMarketType.COINGECKO);
      const coinPrices = await coinGecko.getPriceUsd(coingeckoIds);
      this.logger.debug('coinPrices(): ', JSON.stringify(coinPrices));
      for (const [key, value] of Object.entries(config.currencies)) {
        const coinPrice = coinPrices.find(
          (obj) => obj.id === value.coingeckoApiId,
        );
        if (coinPrice) {
          value.usd = coinPrice.usd;
        }
      }
    } catch (error) {
      const coinMarketcap = new CoinMarketGateway(CoinMarketType.COINMARKET);
      const coinPrices = await coinMarketcap.getPriceUsd(coinmarketcapIds);
      this.logger.debug('coinPrices(): ', JSON.stringify(coinPrices));
      for (const [key, value] of Object.entries(config.currencies)) {
        const coinPrice = coinPrices.find(
          (obj) => obj.id === value.coinmarketcapApiId,
        );
        if (coinPrice) {
          value.usd = coinPrice.usd;
        }
      }
    }
    config.markModified('currencies');
    await config.save();
  }

  @Cron(EVERY_2_MINUTES)
  async pushNotificationMintingEventDaft() {
    const mintingEvents = await this.eventModel.find({
      status: EventStatus.DRAFT,
      startDate: {
        $lte: new Date(),
      },
    });
    for (const event of mintingEvents) {
      const notification = await this.notificationModel.findOne({
        type: NotificationType.P6,
        'mintingEvent.id': event._id,
      });
      if (!notification) {
        await this.commonService.pushNotificationAdmin(NotificationType.P6, {
          mintingEvent: event,
        });
      }
    }
  }

  @Cron(EVERY_2_MINUTES)
  async pushNotificationRewardEventDaft() {
    const rewardEvents = await this.rewardEventModel.find({
      status: RewardEventStatus.DRAFT,
      snapshotDate: {
        $lte: new Date(),
      },
    });
    for (const event of rewardEvents) {
      const notification = await this.notificationModel.findOne({
        type: NotificationType.P10,
        'rewardEvent._id': event._id,
      });
      if (!notification) {
        await this.commonService.pushNotificationAdmin(NotificationType.P10, {
          rewardEvent: event,
        });
      }
    }
  }
}

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

}

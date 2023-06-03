import { Logger } from '@nestjs/common';
import { MAX_RETRY, TIME_WAIT_RETRY } from 'src/common/constants';
import { Utils } from 'src/common/utils';
import { CoinGecko } from './coin-market.coingecko';
import { CoinMarketCap } from './coin-market.coinmarketcap';
import { CoinMarketType, ICoinMarket } from './coin-market.type';

export class CoinMarketGateway {
  private readonly logger = new Logger(CoinMarketGateway.name);

  private instance: ICoinMarket;

  constructor(type: CoinMarketType) {
    if (type === CoinMarketType.COINGECKO) {
      this.instance = new CoinGecko();
    } else if (type === CoinMarketType.COINMARKET) {
      this.instance = new CoinMarketCap();
    } else {
      this.instance = new CoinGecko();
    }
    this.logger.log(`CoinMarket = ${type}`);
  }

  public getPriceUsd(coinIds: string[]) {
    return this.instance.getPriceUsd(coinIds);
  }
}

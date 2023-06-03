import axios from 'axios';
import { CoinPrice, ICoinMarket } from './coin-market.type';

export class CoinMarketCap implements ICoinMarket {
  private BASE_URL = 'https://pro-api.coinmarketcap.com/v2';

  async getPriceUsd(coinIds: string[]): Promise<CoinPrice[]> {
    const coinPrices: CoinPrice[] = [];
    for (let index = 0; index < coinIds.length; index++) {
      const coinId = coinIds[index];
      const url = `${this.BASE_URL}/tools/price-conversion?id=${coinId}&amount=1`;
      const response = await axios.get(url, {
        headers: {
          'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY,
        },
      });
      if (response.status === 200) {
        coinPrices.push({
          id: coinId,
          usd: response.data.data.quote.USD.price,
        });
      } else {
        throw new Error(`Can't get price: ${response.statusText}`);
      }
    }
    return coinPrices;
  }
}

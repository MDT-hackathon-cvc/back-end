import axios from 'axios';
import { CoinPrice, ICoinMarket } from './coin-market.type';

export class CoinGecko implements ICoinMarket {
  private BASE_URL = 'https://api.coingecko.com/api/v3';

  async getPriceUsd(coinIds: string[]): Promise<CoinPrice[]> {
    const url = `${this.BASE_URL}/simple/price?ids=${coinIds}&vs_currencies=usd`;
    const response = await axios.get(url);
    if (response.status === 200) {
      const coinPrices: CoinPrice[] = [];
      for (const [key, value] of Object.entries(response.data)) {
        coinPrices.push({
          id: key,
          usd: Number(value['usd']),
        });
      }
      return coinPrices;
    } else {
      throw new Error(`Can't get price: ${response.statusText}`);
    }
  }
}

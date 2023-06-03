export interface ICoinMarket {
  getPriceUsd(coinIds: string[]): Promise<CoinPrice[]>;
}

export enum CoinMarketType {
  COINGECKO = 'coingecko',
  COINMARKET = 'coinmarket',
}

export interface CoinPrice {
  id: string;
  usd: number;
}

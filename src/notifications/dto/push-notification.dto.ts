import { TransactionDocument } from './../../schemas/Transaction.schema';

import { SimpleNFT } from 'src/schemas/NFT.schema';

export class PushNotificationDto {
  toAddress?: string;
  userAddress?: string;
  referralAddress?: string;

  transaction?: TransactionDocument;
  role?: string;
  commissionFee?: any;
  nft?: SimpleNFT;
  recoverTokenId?: string;
}

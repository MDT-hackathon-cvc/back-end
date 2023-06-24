import { TransactionDocument } from './../../schemas/Transaction.schema';
import { EventDocument } from 'src/schemas/Event.schema';

import { SimpleNFT } from 'src/schemas/NFT.schema';

export class PushNotificationDto {
  toAddress?: string;
  userAddress?: string;
  referralAddress?: string;
  mintingEvent?: EventDocument;

  transaction?: TransactionDocument;
  role?: string;
  commissionFee?: any;
  nft?: SimpleNFT;
  recoverTokenId?: string;
}

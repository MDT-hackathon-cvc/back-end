import { TransactionDocument } from './../../schemas/Transaction.schema';
import { EventDocument } from 'src/schemas/Event.schema';
import { RedemptionDocument } from 'src/schemas/Redemption.schema';
import { RewardEventDocument } from 'src/schemas/RewardEvent.schema';
import { SimpleNFT } from 'src/schemas/NFT.schema';

export class PushNotificationDto {
  toAddress?: string;
  userAddress?: string;
  referralAddress?: string;
  mintingEvent?: EventDocument;
  rewardEvent?: RewardEventDocument;
  redemption?: RedemptionDocument;
  transaction?: TransactionDocument;
  role?: string;
  commissionFee?: any;
  nft?: SimpleNFT;
  recoverTokenId?: string;
}

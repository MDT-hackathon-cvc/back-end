import { Prop, SchemaFactory, Schema } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { SimpleNFT } from './NFT.schema';
import { SimpleRewardEvent } from './RewardEvent.schema';
const paginate = require('mongoose-paginate-v2');
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');

export type DistributionRewardTokenDocument = DistributionRewardToken &
  Document;

@Schema({ timestamps: true, collection: 'distribution_reward_token' })
export class DistributionRewardToken {
  @Prop({ type: SimpleRewardEvent })
  rewardEvent: SimpleRewardEvent;

  @Prop()
  tokenId: string;

  @Prop({ type: Date })
  mintedDate: Date;

  @Prop()
  nft: SimpleNFT;

  @Prop({ type: Object })
  distributedReward: mongoose.Types.Decimal128;

  @Prop()
  beneficiaryAddress: string;
}

export const DistributionRewardTokenSchema = SchemaFactory.createForClass(
  DistributionRewardToken,
);
DistributionRewardTokenSchema.plugin(paginate);
DistributionRewardTokenSchema.plugin(aggregatePaginate);

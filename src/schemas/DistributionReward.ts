import { SimpleRewardEvent } from 'src/schemas/RewardEvent.schema';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
const paginate = require('mongoose-paginate-v2');
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');

export enum DistributionRewardStatus {
  CLAIMED = 'claimed',
  UNCLAIMED = 'unclaimed',
  PROCESSING = 'processing',
}

export type DistributionRewardDocument = DistributionReward & Document;

@Schema({ timestamps: true, collection: 'distribution_reward' })
export class DistributionReward {
  @Prop({ type: SimpleRewardEvent })
  rewardEvent: SimpleRewardEvent;

  @Prop()
  beneficiaryAddress: string;

  @Prop()
  eligibleTokens: number;

  @Prop()
  totalShares: number;

  @Prop({ type: Object })
  distributedReward: mongoose.Types.Decimal128;

  @Prop()
  status: DistributionRewardStatus;

  @Prop()
  hash: string;

  @Prop()
  tokenIds: [];
}

export const DistributionRewardSchema =
  SchemaFactory.createForClass(DistributionReward);
DistributionRewardSchema.plugin(paginate);
DistributionRewardSchema.plugin(aggregatePaginate);

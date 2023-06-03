import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';
const paginate = require('mongoose-paginate-v2');
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');

export type RewardEventDocument = RewardEvent & Document;

export enum RewardEventStatus {
  LIVE = 1,
  COMING_SOON = 2,
  LAUNCHED = 3,
  END = 4,
  DRAFT = 5,
  CANCEL = 6,
}

export class SimpleRewardEvent {
  @Prop({ type: mongoose.Types.ObjectId, ref: 'RewardEvent' })
  _id: object;

  @Prop()
  name: string;

  @Prop()
  launchDate: Date;

  @Prop()
  snapshotDate: Date;

  @Prop()
  distributionDate: Date;

  @Prop()
  requiredDate: Date;

  @Prop()
  endDate: Date;

  @Prop()
  requiredBalance: number;

  @Prop({ type: Object })
  allocatedRewards: mongoose.Types.Decimal128;

  @Prop()
  creatorAddress: string;
}

export class RewardEventSignature {
  @Prop([{ type: Object }])
  data: any[];

  @Prop()
  address: string;

  @Prop()
  hash: string;
}

@Schema({
  timestamps: true,
  collection: 'reward_events',
})
export class RewardEvent {
  @Prop()
  name: string;

  @Prop()
  status: RewardEventStatus;

  @Prop()
  launchDate: Date;

  @Prop()
  snapshotDate: Date;

  @Prop()
  distributionDate: Date;

  @Prop()
  requiredDate: Date;

  @Prop()
  endDate: Date;

  @Prop()
  requiredBalance: number;

  @Prop({ type: Object })
  allocatedRewards: mongoose.Types.Decimal128;

  @Prop({ type: Object })
  totalClaimedRewards: mongoose.Types.Decimal128;

  @Prop()
  totalBeneficiaryWallet: number;

  @Prop()
  totalRewardedWallet: number;

  @Prop()
  totalLockingShares: number;

  @Prop()
  totalRewardedTokens: number;

  @Prop()
  creatorAddress: string;

  @Prop({ default: false })
  isDistribution: boolean;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const RewardEventSchema = SchemaFactory.createForClass(RewardEvent);
RewardEventSchema.plugin(paginate);
RewardEventSchema.plugin(aggregatePaginate);

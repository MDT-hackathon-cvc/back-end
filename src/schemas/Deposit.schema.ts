import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';

export type DepositRewardDocument = DepositReward & Document;

@Schema({
  timestamps: true,
  collection: 'deposit_reward',
})
export class DepositReward {
  @Prop({ unique: true })
  key: string;

  @Prop({ type: Object })
  totalAllocatedRewards: mongoose.Types.Decimal128;

  @Prop({ type: Object })
  totalClaimedReward: mongoose.Types.Decimal128;
}

export const DepositRewardSchema = SchemaFactory.createForClass(DepositReward);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
const paginate = require('mongoose-paginate-v2');
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');

export type LockHistoryDocument = LockHistory & Document;

export enum LockHistoryStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  CANCEL = 'cancel',
  FAILED = 'failed',
}

@Schema({
  timestamps: true,
  collection: 'lock_histories',
})
export class LockHistory {
  @Prop()
  tokenId: string;

  @Prop()
  status: LockHistoryStatus;

  @Prop()
  lockedDate: Date;

  @Prop()
  unlockedDate: Date;

  @Prop()
  creatorAddress: string;

  @Prop()
  lockedHash: string;

  @Prop()
  unlockedHash: string;
}

export const LockHistorySchema = SchemaFactory.createForClass(LockHistory);
LockHistorySchema.plugin(paginate);
LockHistorySchema.plugin(aggregatePaginate);

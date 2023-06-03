import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';

export type LockDocument = Lock & Document;

export enum LockType {
  BUY_NFT = 'buy-nft',
  CANCEL_EVENT = 'cancel-event',
  ADMIN_MINT_NFT = 'admin-mint-nft',
  ADMIN_PUT_ON_SALE = 'admin-put-on-sale',
  PUT_ON_SALE = 'put-on-sale',
  TRANSFER_NFT = 'transfer-nft',
  CREATE_REDEMPTION = 'create-redemption',
  UPDATE_REDEMPTION = 'update-redemption',
  APPROVE_REDEMPTION = 'approve-redemption',
  CANCEL_REDEMPTION = 'cancel-redemption',
  UPDATE_EVENT = 'update-event',
  UPDATE_REWARD_EVENT = 'update-reward-event',
  DEPOSIT = 'deposit',
  ADMIN_SETTING = 'admin-setting',
  CLAIMED = 'claimed',
  COUNT_DOWN_REWARD_EVENT = 'count-down-reward-event',
  RECOVER = 'recover',
}
@Schema({
  timestamps: true,
})
export class Lock {
  @Prop({ required: true })
  type: string;

  @Prop({ unique: true, required: true })
  documentId: string;

  @Prop({ type: Date, default: new Date(new Date().getTime() + 5000) }) // Lock 5s
  lockUntil: Date;
}

export const LockSchema = SchemaFactory.createForClass(Lock);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
const paginate = require('mongoose-paginate-v2');
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');
import { EventOfNFT } from './Event.schema';
import { SimpleNFT } from './NFT.schema';

export type OwnerDocument = Owner & Document;

export enum OwnerStatus {
  LOCKED = 'locked',
  UNLOCKED = 'unlocked',
  BURNED = 'burned',
  REDEEMED = 'redeemed',
  INVALID = 'invalid',
}

@Schema({
  timestamps: true,
  collection: 'owners',
})
export class Owner {
  @Prop()
  tokenId: string;

  @Prop()
  mintedAddress: string;

  @Prop({ default: false })
  isMintedAddressAdmin: boolean;

  @Prop()
  address: string;

  @Prop({ default: false })
  isAddressAdmin: boolean;

  @Prop({ type: EventOfNFT })
  event: EventOfNFT;

  @Prop()
  mintedHash: string;

  @Prop({ type: Date })
  mintedDate: Date;

  @Prop({ type: Object })
  mintedValue: mongoose.Types.Decimal128;

  @Prop({ default: false })
  status: OwnerStatus;

  // số lượng reward events mà token này tham gia
  @Prop({ default: 0 })
  rewardEvents: number;

  // tổng số tiền mà token này đc trả thưởng
  @Prop({ type: Object })
  allocatedRewards: mongoose.Types.Decimal128;

  // lưu theo mili giây
  @Prop({ default: 0 })
  lockingBalance: number;

  // lưu thời điểm lock hoặc unlock cuối cùng
  @Prop({ type: Date, default: null })
  lastLockDate: Date;

  @Prop({ type: mongoose.Types.ObjectId, ref: 'NFT' })
  nftId: object;

  @Prop()
  nft: SimpleNFT;

  @Prop({ type: Boolean, default: false })
  isTransfer: boolean;
}

export const OwnerSchema = SchemaFactory.createForClass(Owner);
OwnerSchema.index({tokenId: 1}, {unique: true})
OwnerSchema.plugin(paginate);
OwnerSchema.plugin(aggregatePaginate);

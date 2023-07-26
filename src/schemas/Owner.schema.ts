import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
const paginate = require('mongoose-paginate-v2');
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');
import { SimpleNFT } from './NFT.schema';

export type OwnerDocument = Owner & Document;

export enum OwnerStatus {
  LOCKED = 'locked',
  UNLOCKED = 'unlocked',
  BURNED = 'burned',
  REDEEMED = 'redeemed',
  INVALID = 'invalid',
  MINTED = 'mint'
}

@Schema({
  timestamps: true,
  collection: 'owners',
})
export class Owner {
  @Prop()
  tokenId: string;

  @Prop()
  amount: number;

  @Prop()
  mintedAddress: string;

  @Prop()
  address: string;

  @Prop()
  mintedHash: string;

  @Prop({ type: Date })
  mintedDate: Date;

  @Prop({ type: Object })
  mintedValue: mongoose.Types.Decimal128;

  @Prop({ default: false })
  status: OwnerStatus;

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

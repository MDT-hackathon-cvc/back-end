import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';
const paginate = require('mongoose-paginate-v2');
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');
import { EventOfNFT } from './Event.schema';

export type NFTDocument = NFT & Document;

export enum TokenStandard {
  ERC_721 = 'erc-721',
  ERC_1155 = 'erc-1155',
}

export enum NFTStatus {
  OFF_SALE = 'off-sale',
  ON_SALE = 'on-sale',
  SOLD_OUT = 'sold-out',
}

export enum OwnerStatus {
  LOCKED = 'locked',
  UNLOCKED = 'unlocked',
  BURNED = 'burned',
  REDEEMED = 'redeemed',
  INVALID = 'invalid',
}
export class NFTMedia {
  @Prop()
  url: string;

  @Prop()
  type: string;

  @Prop()
  mimeType: string;
}

export class NFTImage {
  @Prop()
  url: string;

  @Prop()
  smallUrl: string;

  @Prop()
  mediumUrl: string;

  @Prop()
  mimeType: string;
}

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

  @Prop({ default: 0 })
  rewardEvents: number;

  @Prop({ type: Object })
  allocatedRewards: mongoose.Types.Decimal128;

  // lưu theo giây
  @Prop({ default: 0 })
  lockingBalance: number;

  @Prop({ type: Date, default: null })
  lastLockDate: Date;
}

export class HistorySupply {
  @Prop({ type: Number })
  oldTotalSupply: number;

  @Prop({ type: Number })
  newTotalSupply: number;

  @Prop({ type: Date })
  date: Date;
}

// @Schema()
export class SimpleToken {
  @Prop({ type: TokenStandard })
  standard: TokenStandard;

  @Prop()
  totalSupply: number;

  @Prop({ type: Object, default: 0 })
  totalMinted: number;

  @Prop()
  cid: string;
}

// @Schema()
export class Token extends SimpleToken {
  @Prop()
  address: string;

  @Prop()
  ids: string[];

  // @Prop()
  // cid: string;

  @Prop()
  cidMedia: string;

  // @Prop({ type: TokenStandard })
  // standard: TokenStandard;

  // @Prop()
  // totalSupply: number;

  // @Prop()
  // totalMinted: number;

  @Prop()
  totalAvailable: number;

  @Prop({ type: Number, default: 0 })
  totalBurnt: number;

  @Prop({ type: HistorySupply })
  historySupply: HistorySupply[];
}

export class SimpleNFT {
  @Prop({ type: mongoose.Types.ObjectId, ref: 'NFT' })
  id: object;

  @Prop()
  name: string;

  @Prop()
  code: string;

  @Prop()
  slug: string;

  @Prop()
  token: SimpleToken;

  @Prop()
  image: NFTImage;

  @Prop()
  royaltyFee: number;

  @Prop()
  description: string;

  @Prop()
  noOfShare: number;

  @Prop()
  isNFTBlack: boolean;
}

@Schema({
  timestamps: true,
})
export class NFT {
  @Prop()
  code: string;

  @Prop()
  name: string;

  @Prop()
  slug: string;

  @Prop()
  description: string;

  @Prop()
  image: NFTImage;

  @Prop()
  media: NFTMedia;

  @Prop()
  royaltyFee: number;
  // type: SimpleCommission, default: {}, _id: false
  @Prop({ type: Token, default: {}, _id: false })
  token: Token;

  @Prop()
  creatorAddress: string;

  @Prop()
  status: NFTStatus;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Date })
  boughtAt: Date;

  @Prop()
  noOfShare: number;

  @Prop({ default: false })
  isNFTBlack: boolean;

  @Prop()
  ipfsImage: string;

  @Prop()
  ipfsMetadata: string;
}

export const NFTSchema = SchemaFactory.createForClass(NFT);
NFTSchema.plugin(paginate);
NFTSchema.plugin(aggregatePaginate);

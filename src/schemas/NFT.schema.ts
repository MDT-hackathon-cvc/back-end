import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';
const paginate = require('mongoose-paginate-v2');
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');

export type NFTDocument = NFT & Document;

export enum TokenStandard {
  ERC_721 = 'erc-721',
  ERC_1155 = 'erc-1155',
}

export enum NFTStatus {
  OFF_SALE = 'OFF-SALE',
  ON_SALE = 'ON-SALE',
  SOLD_OUT = 'SOLD-OUT',
  MINTED = 'MINTED',
  UNMINT = 'UNMINT'
}

export enum OwnerStatus {
  LOCKED = 'LOCKED',
  UNLOCKED = 'UNLOKCED',
  BURNED = 'BURNED',
  REDEEMED = 'REDEEMED',
  INVALID = 'INVALID',
  UNMINT = 'UNMINT',
  MINTED = 'MINTED'
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

export class Token extends SimpleToken {
  @Prop()
  address: string;

  @Prop()
  ids: number;

  @Prop()
  cid: string;

  @Prop()
  cidMedia: string;

  @Prop({ type: TokenStandard })
  standard: TokenStandard;

  @Prop()
  totalSupply: number;

  @Prop()
  totalMinted: number;

  @Prop()
  totalAvailable: number;

  @Prop({ type: Number, default: 0 })
  totalBurnt: number;
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
  image: NFTImage;
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
  ipfsImage: string;

  @Prop()
  ipfsMetadata: string;

  @Prop()
  price: number;

  @Prop()
  orderId: string;

  @Prop()
  hashPutOnSale: string;
}

export const NFTSchema = SchemaFactory.createForClass(NFT);
NFTSchema.plugin(paginate);
NFTSchema.plugin(aggregatePaginate);

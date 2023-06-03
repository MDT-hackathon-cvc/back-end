import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';
const paginate = require('mongoose-paginate-v2');
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');

export type RedemptionDocument = Redemption & Document;

export enum RedemptionStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  SUBMITTED = 'submitted',
  REDEEMABLE = 'redeemable',
  CANCELED = 'canceled',
  REDEEMED = 'redeemed',
  FAILED = 'failed',
}

export class SimpleRedemption {
  @Prop({ type: mongoose.Types.ObjectId, ref: 'Redemption' })
  _id: object;

  @Prop()
  creatorAddress: string;

  @Prop()
  items: RedemptionItem[];

  @Prop({ type: Object })
  totalValue: mongoose.Types.Decimal128;

  @Prop()
  requestId: string;

  @Prop()
  approvedDate: Date;
}

export class RedemptionItem {
  @Prop({ type: mongoose.Types.ObjectId, ref: 'NFT' })
  nftId: object;

  @Prop()
  nftImage: string;

  @Prop()
  nftName: string;

  @Prop()
  tokenId: string;

  @Prop({ type: Object })
  value: mongoose.Types.Decimal128;
}
export class EventSignature {
  // @Prop([{ type: Object }])
  // dataContract: any[];

  @Prop([{ type: Object }])
  data: any[];

  @Prop()
  address: string;

  @Prop()
  hash: string;
}

@Schema({
  timestamps: true,
})
export class Redemption {
  @Prop()
  status: RedemptionStatus;

  @Prop()
  creatorAddress: string;

  @Prop()
  items: RedemptionItem[];

  @Prop()
  numberCategories: number;

  @Prop()
  quantity: number;

  @Prop({ type: Object })
  totalValue: mongoose.Types.Decimal128;

  @Prop({ type: EventSignature })
  signature: EventSignature;

  @Prop()
  hash: string;

  @Prop()
  message: string;

  @Prop()
  code: string;

  @Prop()
  requestId: string;

  @Prop()
  approvedDate: Date;
}

export const RedemptionSchema = SchemaFactory.createForClass(Redemption);
RedemptionSchema.plugin(paginate);
RedemptionSchema.plugin(aggregatePaginate);

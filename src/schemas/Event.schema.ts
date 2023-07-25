import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';
const paginate = require('mongoose-paginate-v2');
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');

export type EventDocument = Event & Document;

export enum EventType {
  PUBLIC = 'public',
  WHITE_LIST = 'whitelist',
}
export enum EventStatus {
  LIVE = 1,
  COMING_SOON = 2,
  END = 3,
  DRAFT = 4,
  CANCEL = 5,
}

export class CategoryInEvent {
  @Prop({ type: mongoose.Types.ObjectId, ref: 'NFT' })
  nftId: object;

  @Prop()
  image: string;

  @Prop()
  name: string;

  @Prop()
  currency: string;

  @Prop()
  quantityForSale: number;

  @Prop()
  totalMinted: number;

  @Prop({ type: Object })
  unitPrice: mongoose.Types.Decimal128;
}
export class WhiteList {
  @Prop()
  address: string[];

  @Prop()
  url: string;

  @Prop()
  fileName: string;

  @Prop()
  size: number;
}
export class EventSignature {
  @Prop([{ type: Object }])
  data: any[];

  @Prop()
  address: string;

  @Prop()
  hash: string;
}

export class EventOfNFT {
  @Prop([{ type: mongoose.Types.ObjectId, ref: 'Event' }])
  id: object;

  @Prop()
  imgUrl: string;

  @Prop()
  name: string;
}

export class SimpleEvent {
  // TODO: check again
  @Prop([{ type: mongoose.Types.ObjectId, ref: 'Event' }])
  id: object;

  @Prop()
  category: CategoryInEvent;

  @Prop()
  creatorAddress: string;

  @Prop()
  name: string;

  @Prop()
  imgUrl: string;
}

@Schema({
  timestamps: true,
  collection: 'events',
})
export class Event {
  @Prop()
  name: string;

  @Prop()
  description: string;

  @Prop()
  imgUrl: string;

  @Prop()
  type: EventType;

  @Prop()
  status: EventStatus;

  @Prop()
  limitPerTransaction: number;

  @Prop()
  startDate: Date;

  @Prop()
  endDate: Date;

  @Prop()
  endTimeOrigin: Date;

  @Prop()
  creatorAddress: string;

  @Prop({ type: EventSignature })
  signature: EventSignature;

  @Prop()
  categories: CategoryInEvent[];

  @Prop({ type: Object, default: 0 })
  totalRevenue: mongoose.Types.Decimal128;

  @Prop({ type: Object, default: 0 })
  adminEarnings: mongoose.Types.Decimal128;

  @Prop()
  whitelistInfo: WhiteList;

  @Prop({ default: false })
  isPrivate: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  hashCancel: string;
}

export const EventSchema = SchemaFactory.createForClass(Event);
EventSchema.plugin(paginate);
EventSchema.plugin(aggregatePaginate);

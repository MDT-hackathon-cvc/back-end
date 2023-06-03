import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';

export type CounterDocument = Counter & Document;

export enum CounterName {
  NFT = 'nft',
  TOKEN = 'token',
  REQUEST_ID = 'request-id',
}
@Schema({
  timestamps: true,
})
export class Counter {
  @Prop({ unique: true })
  name: string;

  @Prop({ default: 1 })
  index: number;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);

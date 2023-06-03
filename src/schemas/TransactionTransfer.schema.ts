import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';
import { TokenStandard } from './NFT.schema';
const paginate = require('mongoose-paginate-v2');
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');

export type TransactionTransferDocument = TransactionTransfer & Document;

export enum TransactionTransferStatus {
  PENDING = 'pending',
  SKIP = 'skip',
  SYNCED = 'synced',
}

@Schema({
  timestamps: true,
  collection: 'transaction_transfers',
})
export class TransactionTransfer {
  @Prop()
  hash: string;

  @Prop()
  logIndex: number;

  @Prop()
  type: TokenStandard;

  @Prop()
  fromAddress: string;

  @Prop()
  toAddress: string;

  @Prop()
  tokenId: string;

  @Prop()
  blockNumber: number;

  @Prop()
  quantity: number;

  @Prop({ default: TransactionTransferStatus.PENDING })
  status: TransactionTransferStatus;
}

export const TransactionTransferSchema =
  SchemaFactory.createForClass(TransactionTransfer);
TransactionTransferSchema.index({
  hash: 1,
  logIndex: 1,
});
TransactionTransferSchema.plugin(paginate);
TransactionTransferSchema.plugin(aggregatePaginate);

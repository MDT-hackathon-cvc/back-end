import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';
import { TokenStandard } from './NFT.schema';
const paginate = require('mongoose-paginate-v2');
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');

export type TransactionTransferSyncDocument = TransactionTransferSync &
  Document;

@Schema({
  timestamps: true,
  collection: 'transaction_transfer_syncs',
})
export class TransactionTransferSync {
  @Prop()
  type: TokenStandard;

  @Prop()
  fromBlock: number;

  @Prop()
  toBlock: number;

  @Prop()
  latestBlock: number;

  @Prop()
  totalTransactions: number;

  @Prop()
  totalTransactionSyncs: number;
}

export const TransactionTransferSyncSchema = SchemaFactory.createForClass(
  TransactionTransferSync,
);
TransactionTransferSyncSchema.plugin(paginate);
TransactionTransferSyncSchema.plugin(aggregatePaginate);

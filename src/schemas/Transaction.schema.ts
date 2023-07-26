

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
import { Contract } from 'src/common/constants';
import { SimpleNFT } from './NFT.schema';
import { UserRole, UserStatus } from './User.schema';
const paginate = require('mongoose-paginate-v2');
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');

export type TransactionDocument = Transaction & Document;

export enum TransactionType {
  LISTED = 'listed',
  CANCELED = 'delisted',
  MINTED = 'minted',
  TRANSFER = 'transfer',
  ADMIN_MINTED = 'admin-minted',
  TRANSFER_OUTSIDE = 'transfer-outsite',
  CREATE_REDEMPTION = 'create-redemption',
  CANCEL_REDEMPTION = 'cancel-redemption',
  APPROVE_REDEMPTION = 'approve-redemption',
  DEPOSIT = 'deposit',
  ADMIN_SETTING = 'admin-setting',
  ADMIN_UPDATE = 'admim-update',
  ADMIN_ACTIVE = 'admin-active',
  ADMIN_DEACTIVE = 'admin-deactive',
  ADMIN_DELETE = 'admin-delete',
  CLAIMED = 'claimed',
  RECOVER = 'recover',
  BUY = 'buy'
}

export enum TransactionStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  CANCEL = 'cancel',
  FAILED = 'failed',
}


@Schema({
  timestamps: true,
})
export class Transaction {
  @Prop({ type: SimpleNFT })
  nft: SimpleNFT;

  @Prop()
  type: TransactionType;

  @Prop()
  fromAddress: string;

  @Prop()
  toAddress: string;

  @Prop()
  quantity: number;

  @Prop()
  status: TransactionStatus;

  @Prop()
  hash: string;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
TransactionSchema.plugin(paginate);
TransactionSchema.plugin(aggregatePaginate);

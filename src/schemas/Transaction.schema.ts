

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
import { Contract } from 'src/common/constants';
import { SimpleEvent } from './Event.schema';
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
}

export enum TransactionStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  CANCEL = 'cancel',
  FAILED = 'failed',
}

export class TransactionSignature {
  @Prop([{ type: Object }])
  data: any[];

  @Prop([{ type: Object }])
  dataRequest?: any[];

  @Prop()
  address: string;

  @Prop()
  hash: string;
}
@Schema()
export class SimpleCommission {
  @Prop({ default: Contract.ZERO_ADDRESS })
  address: string;

  @Prop({ type: Object, default: 0 })
  commissionFee: mongoose.Types.Decimal128;

  @Prop({ default: 0 })
  percentage: number;

  @Prop({ default: '' })
  role: string;
}

@Schema()
export class AffiliateInfor {
  @Prop({ type: SimpleCommission, default: {}, _id: false })
  bda: SimpleCommission;

  @Prop({ type: SimpleCommission, default: {}, _id: false })
  referrerDirect: SimpleCommission;
}

export class AdminTemp {
  @Prop({ type: String, default: '' })
  adminName: string;

  @Prop({ type: String, default: '' })
  address: string;

  @Prop({ type: Array, default: [] })
  permissions: string[];

  @Prop({ type: String, default: UserStatus.DRAFT })
  status: string;

  @Prop({ type: String, default: UserRole.ADMIN })
  role: string;

  @Prop({ type: Boolean, default: false })
  isHavingAction: boolean;
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
  tokenIds: string[];

  @Prop()
  quantity: number;

  @Prop({ type: Object })
  depositAmount: mongoose.Types.Decimal128;

  @Prop({ type: Object })
  revenue: mongoose.Types.Decimal128;

  @Prop({ type: Object })
  revenueUsd: mongoose.Types.Decimal128;

  @Prop()
  status: TransactionStatus;

  @Prop()
  hash: string;

  @Prop()
  syncedAt: Date;

  @Prop()
  message: string;

  @Prop({ type: TransactionSignature })
  signature: TransactionSignature;

  @Prop({ type: SimpleEvent })
  event: SimpleEvent;

  @Prop({ type: AffiliateInfor, default: {}, _id: false })
  affiliateInfor?: AffiliateInfor;



  @Prop({ type: Object })
  adminEarning: mongoose.Types.Decimal128;

  @Prop({ type: String, default: null })
  adminMintedAddress: string;



  @Prop({ type: Object })
  totalDistributedReward: mongoose.Types.Decimal128;

  @Prop()
  rewardEventIds: string[];

  @Prop({ type: AdminTemp, default: {}, _id: false })
  dataAdminTemp: AdminTemp;

  @Prop()
  faultyToken: string;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
TransactionSchema.plugin(paginate);
TransactionSchema.plugin(aggregatePaginate);

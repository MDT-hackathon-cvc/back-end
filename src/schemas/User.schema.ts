import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
const paginate = require('mongoose-paginate-v2');
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');

export type UserDocument = User & Document;

export enum UserStatus {
  ACTIVE = 'active',
  BANNED = 'banned',
  DEACTIVE = 'deactive',
  PROCESSING = 'processing',
  DRAFT = 'draft',
}

export enum UserRole {
  SUPER_ADMIN = 'super-admin',
  SYSTEM = 'system',
  ADMIN = 'admin',
  USER = 'user',
  WORKER = 'worker',
}

export enum UserType {
  ALL = 0,
  COMMON = 1,
  BDA = 2,
}

export enum KYCStatus {
  UNVERIFIED = 1,
  PENDDING = 2,
  REJECTED = 3,
  VERIFIED = 4,
}

export enum AdminPermissions {
  USER_MANAGEMENT = 'USER_MANAGEMENT',
  EVENT_MANAGEMENT = 'EVENT_MANAGEMENT',
  REDEMPTION_MANAGEMENT = 'REDEMPTION_MANAGEMENT',
  NFT_MANAGEMENT = 'NFT_MANAGEMENT',
  LOCKING_MANAGEMENT = 'LOCKING_MANAGEMENT',
  REVENUE_MANAGEMENT = 'REVENUE_MANAGEMENT',
  ROLE_MANAGEMENT = 'ROLE_MANAGEMENT',
}

export enum AdminActions {
  ADD_ADMIN = 'ADD_ADMIN',
  UPDATE_ADMIN = 'UPDATE_ADMIN',
  DELETE_ADMIN = 'DELETE_ADMIN',
  ACTIVATE = 'ACTIVATE',
  DEACTIVATE = 'DEACTIVATE',
}

export const SUPER_ADMIN_NAME = 'Super Admin';

@Schema()
export class KYCImage {
  @Prop({ default: '' })
  selfieUrl: string; // identities.selfie.value

  @Prop({ default: '' })
  documentUrl: string; // identities.national_id.value || identities.driving_license.value || identities.passport.value
}

@Schema()
export class KYCInfo {
  @Prop({ default: KYCStatus.UNVERIFIED })
  kycStatus: KYCStatus;

  @Prop({ default: '' })
  event: string;

  @Prop({ default: '' })
  fullName: string;

  @Prop({ type: Date })
  dateOfBirth: Date;

  @Prop({ type: Date })
  waitingDate: Date;

  @Prop({ type: Date })
  inreviewDate: Date;

  @Prop({ type: Date })
  approvedDate: Date;

  @Prop({ default: '' })
  email: string;

  @Prop({ default: '' })
  mobile: string; // identities.address.value

  @Prop({ default: '' })
  countryCode: string; // national_id_issuing_country VNM viet nam

  @Prop({ default: '' })
  nationality: string; // national_id_issuing_country VNM viet nam

  @Prop({ default: '' })
  residentialAddress: string;

  @Prop({ default: '' })
  kycDocument: string;

  @Prop({ type: KYCImage, default: {}, _id: false })
  kycPhotos: KYCImage;
}

@Schema({
  timestamps: true,
})
export class User {
  @Prop({ default: '' })
  refId: string;

  @Prop({ unique: true })
  address: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: UserRole.USER })
  role: UserRole;

  @Prop({ default: UserStatus.ACTIVE })
  status: UserStatus;

  @Prop({ default: UserType.COMMON })
  userType: UserType;

  @Prop({ default: 0 })
  directReferee: number;

  @Prop({ default: 0 })
  equityShare: number;

  @Prop({ type: KYCInfo, default: {}, _id: false })
  kycInfo: KYCInfo;

  // token sold of direct referree
  @Prop({ default: 0 })
  personalTokenSold: number;

  // volume of direct referree
  @Prop({ type: Object, default: 0 })
  personalVolume: mongoose.Types.Decimal128;

  @Prop({ type: Object, default: 0 })
  oldPersonalVolume: mongoose.Types.Decimal128;

  // volume of user
  @Prop({ type: Object, default: 0 })
  volume: mongoose.Types.Decimal128;

  @Prop({ type: Object, default: 0 })
  commission: mongoose.Types.Decimal128;

  @Prop({ default: '' })
  referrer: string;

  @Prop({ default: '' })
  originator: string;

  @Prop({ default: [] })
  pathId: string[];

  @Prop({ default: '' })
  adminName: string;

  @Prop({ default: [] })
  permissions: string[];

  @Prop({ default: false })
  isHavingAction: boolean;

  @Prop({ default: false })
  haveReceivedBlackFromAdmin: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.plugin(paginate);
UserSchema.plugin(aggregatePaginate);

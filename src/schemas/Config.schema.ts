import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ConfigDocument = Config & Document;

export enum AttributeType {
  TEXT = 'text',
  SELECT = 'select',
  RANGE = 'range',
}
export enum AttributeTypeUser {
  CHECKBOX_GROUP = 'checkboxgroup',
}
export class AttributeSelect {
  @Prop()
  text: string;

  @Prop()
  imgUrl: string;
}
export class Attribute {
  @Prop()
  display: string;

  @Prop()
  type: AttributeType;

  @Prop()
  typeUser: AttributeTypeUser;

  @Prop({ type: Object })
  value: any;

  @Prop({ default: true })
  required: boolean;
}
export interface IAttribute {
  [key: string]: Attribute;
}

export class SimpleCurrency {
  @Prop()
  name: string;

  @Prop()
  displayName: string;

  @Prop()
  symbol: string;

  @Prop()
  chainId: number;

  @Prop()
  usd: number;

  @Prop()
  imageUrl: string;

  @Prop()
  isNativeToken: boolean;
}

export class Currency {
  @Prop()
  chainId: number;

  @Prop()
  name: string;

  @Prop()
  displayName: string;

  @Prop()
  symbol: string;

  @Prop()
  imageUrl: string;

  @Prop()
  usd: number;

  @Prop()
  address: string;

  @Prop()
  decimals: number;

  @Prop()
  coingeckoApiId: string;

  @Prop()
  coinmarketcapApiId: string;

  @Prop({ default: false })
  isNativeToken: boolean;
}
export interface ICurrency {
  [key: string]: Currency;
}

export class Signer {
  @Prop()
  address: string;

  @Prop()
  privateKey: string;
}

@Schema({
  timestamps: true,
})
export class Config {
  @Prop({ type: Object })
  attributes: IAttribute;

  @Prop({ type: Object })
  currencies: ICurrency;

  @Prop()
  ipfsGateway: string;

  @Prop()
  mintingQuantityMax: number;

  @Prop()
  userMintingQuantityMax: number;

  @Prop({ type: Signer })
  signer: Signer;
}

export const ConfigSchema = SchemaFactory.createForClass(Config);

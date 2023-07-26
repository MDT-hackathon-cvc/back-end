import { Transaction, TransactionDocument } from './Transaction.schema';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { SimpleNFT } from './NFT.schema';
const paginate = require('mongoose-paginate-v2');
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');

export type NotificationDocument = Notification & Document;

export enum NotificationAddress {
  USER = 'user',
  ADMIN = 'admin',
}

export enum NotificationType {
  N1 = 'N1',
  N2 = 'N2',
  N3 = 'N3',
  N4 = 'N4',
  N5 = 'N5',
  N6 = 'N6',
  N7 = 'N7',
  N8 = 'N8',
  N9 = 'N9',
  N10 = 'N10',
  N11 = 'N11',
  N12 = 'N12',
  N13 = 'N13',
  N14 = 'N14',
  N15 = 'N15',
  N16 = 'N16',
  N17 = 'N17',
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3',
  P4 = 'P4',
  P5 = 'P5',
  P6 = 'P6',
  P7 = 'P7',
  P8 = 'P8',
  P9 = 'P9',
  P10 = 'P10',
  P11 = 'P11',
  P12 = 'P12',
  P13 = 'P13',
}
export enum Content {
  N1 = 'Congratulations! Your KYC profile has been verified. Refer Brillianz to your friends and family to start earning rewards',
  N2 = 'Unfortunately, your KYC profile has been rejected. Please resubmit your KYC',
  N3 = 'Hurray! You have gained the BDA entitle. A special Black Diamond NFT is on the way to your wallet',
  N4 = 'Hurray! You have regained the BDA entitle',
  N5 = 'Unfortunately, you have lost the BDA title, for there are no Black Diamond NFTs in your wallet. You can regain BDA either by obtaining another $50,000 in referral volume, or by obtaining a Black Diamond NFT',
  N6 = 'Unfortunately, you have lost the BDA title, for there are no Brillianz NFTs in your wallet. You can regain BDA by minting or trading events to have at least 1 Brillianz in your wallet',
  N7 = 'You have reached the required referral volume, but lack 1 Brillianz NFT in wallet to become BDA. Please buy NFT to become a BDA now',
  N8 = 'A minting event named %eventName% is coming soon. You can buy the NFTs once the event starts',
  N9 = 'The minting event %eventName% is live. You may purchase NFTs now!',
  N10 = 'Your redemption request %requestId% has been approved. Please bring the redeem code to our stores to get your diamond(s)',
  N11 = 'Your NFTs in the redemption request %requestId% has been successfully redeemed',
  N12 = 'Hurray! You have received a Black Diamond NFT from us as the BDA reward. Please obtain at least a black diamond NFT in your wallet to remain as BDA',
  N13 = 'User %userAddress% has just accessed via your referral link and become your referee',
  N14 = 'User %userAddress% has just become a member of your organisation by accessing via the referral link of %referralAddress%',
  N15 = 'You have earned %commissionFee% USDT commission from the purchase of user %userAddress% as %role%',
  N16 = 'Your %invalidNftName% %invalidTokenId% is no longer valid and has no use values within the system. As a replacement for this item, we have minted a new %recoverNftName% %recoverTokenId% to your wallet. Please contact us if you need further support',
  N17 = 'Your %invalidNftName% %invalidTokenId% is no longer valid and has no use values within the system. Please contact us if you need further support',
  P1 = '%quantity% %nftName% was minted for %unitPrice% per NFT by %address% in event named %eventName%',
  P2 = '%nftName% has run out of supply. Please increase supply before selling or minting',
  P3 = 'User %toAddress% has become a BDA. Please mint a black diamond NFT for the user within 24 hours',
  P4 = 'Minting event %eventName% is live now',
  P5 = 'Minting event %eventName% has ended',
  P6 = 'Minting event %eventName% has reached its start date, but it appears you have not launched the event yet',
  P7 = 'Beneficiary list of reward Event %eventName% has been finalised. Check it out!',
  P8 = 'Reward Event %eventName% is live now',
  P9 = 'All beneficiaries in reward Event %eventName% has claimed their rewards',
  P10 = 'Reward event %eventName% has reached its snapshot date, but it appears you have not launched the event yet',
  P11 = 'The available funds in contract is insufficient for the locking rewards. Please deposits additional reward to operate the pool',
  P12 = 'The diamond redemption request %requestId% has been submitted by %creatorAddress%',
  P13 = 'Reward event %eventName% has been cancelled, for there are no eligible beneficiaries',
}

@Schema({
  timestamps: true,
})
export class Notification {
  @Prop()
  address: string;

  @Prop({ default: [] })
  receiverAddresses: string[];

  @Prop()
  type: NotificationType;

  @Prop()
  content: string;

  @Prop({ default: [] })
  addressRead: string[];

  @Prop()
  toAddress: string;

  @Prop({ type: SimpleNFT })
  nft: SimpleNFT;

  @Prop({ type: Transaction })
  transaction: TransactionDocument;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.plugin(paginate);
NotificationSchema.plugin(aggregatePaginate);

import {
  User,
  UserDocument,
  UserRole,
  UserStatus,
} from './../schemas/User.schema';

import { NFT, NFTDocument } from './../schemas/NFT.schema';

import { Injectable, Logger, LogLevel } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import {
  Transaction,
  TransactionDocument,
  TransactionType,
  TransactionStatus,
} from 'src/schemas/Transaction.schema';

import mongoose from 'mongoose';
import { Utils } from 'src/common/utils';
import {
  CacheKeyName,
  ErrorCode,
} from 'src/common/constants';
import { CommonService } from 'src/common-service/common.service';
import * as moment from 'moment';
import { RecoverTransactionDto } from './dto/admin/recover-transaction.dto';
import { UserJWT } from 'src/auth/role.enum';
import { ApiError } from 'src/common/api';

import { Owner, OwnerDocument, OwnerStatus } from 'src/schemas/Owner.schema';

@Injectable()
export class TransactionsAdminService {
  private readonly logger = new Logger(TransactionsAdminService.name);

  constructor(
    @InjectModel(Transaction.name)
    private transactionModel: Model<TransactionDocument>,
    private commonService: CommonService,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(NFT.name)
    private nftModel: Model<NFTDocument>,
    @InjectModel(Owner.name)
    private ownerModel: Model<OwnerDocument>,

  ) {}

  async findOne(id: string) {
    const cacheKey = CacheKeyName.GET_TRANSACTIONS_DETAIL_BY_ID(id);
    let transactionDetail = await this.commonService.getCache(cacheKey);
    if (!transactionDetail) {
      transactionDetail = await this.transactionModel.aggregate([
        {
          $match: {
            _id: Utils.toObjectId(id),
          },
        },
        {
          $lookup: {
            from: 'nfts',
            localField: 'nft.id',
            foreignField: '_id',
            as: 'nftDetail',
          },
        },
        {
          $unwind: '$nftDetail',
        },
        {
          $addFields: {
            'nft.attributes': '$nftDetail.attributes',
            'nft.token.totalSupply': '$nftDetail.token.totalSupply',
          },
        },
        {
          $unset: ['signature', 'nftDetail'],
        },
      ]);
      await this.commonService.setCache(cacheKey, transactionDetail);
    }
    return transactionDetail;
  }

  async getSoldNfts(match: any) {
    const pipe: mongoose.PipelineStage[] = [
      {
        $match: {
          status: TransactionStatus.SUCCESS,
          type: { $in: [TransactionType.MINTED, TransactionType.TRANSFER] },
        },
      },
      {
        $project: {
          nftId: '$nft.id',
          day: '$createdAt',
          hours: { $hour: '$createdAt' },
        },
      },
      {
        $match: {
          ...match,
        },
      },
      {
        $group: {
          _id: {
            id: '$nftId',
          },
        },
      },
    ];
    const transactions = await this.transactionModel.aggregate([...pipe]);
    return transactions.length;
  }

  async getNewUsers(match: any) {
    const pipe: mongoose.PipelineStage[] = [
      {
        $match: {
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
        },
      },
      {
        $project: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: '$createdAt',
          week: { $week: '$createdAt' },
          hours: { $hour: '$createdAt' },
        },
      },
      {
        $match: {
          ...match,
        },
      },
    ];
    const users = await this.userModel.aggregate([...pipe]);
    return users.length;
  }

  async createRecoverTransaction(user: UserJWT, body: RecoverTransactionDto) {
    await this.commonService.updateStatusAdminAction(user.address);
    const { nftId, faultyToken, recipientAddress } = body;
    const [signer, nft] = await Promise.all([
      this.commonService.findSigner(),
      this.commonService.findNFTById(nftId),
    ]);

    // Is faulty token in nftId
    const ownerInfo = await this.ownerModel.aggregate([
      {
        $match: {
          tokenId: faultyToken,
          nftId: Utils.toObjectId(nftId),
          status: { $ne: OwnerStatus.INVALID },
        },
      },
    ]);
    if (ownerInfo?.length === 0) {
      throw ApiError();
    }
    // is faulty token redeemed
  
    // lets start create transaction
    const transactionId = Utils.createObjectId();
    const data = {
      collection: process.env.CONTRACT_ERC_721,
      signer,
      tokenId: +faultyToken,
      nft,
      transactionId: transactionId,
      receiver: recipientAddress,
    };

    return this.transactionModel.create({
      _id: transactionId,
      nft: this.commonService.convertToSimpleNFT(nft),
      type: TransactionType.RECOVER,
      fromAddress: user.address,
      toAddress: recipientAddress,
      quantity: 1,
      status: TransactionStatus.DRAFT,
      faultyToken,
    });
  }
}

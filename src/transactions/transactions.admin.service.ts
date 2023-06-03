import {
  User,
  UserDocument,
  UserRole,
  UserStatus,
} from './../schemas/User.schema';

import { NFT, NFTDocument } from './../schemas/NFT.schema';

import { Injectable, Logger, LogLevel } from '@nestjs/common';
import { CreateTransactionDto } from './dto/user/create-transaction.dto';
import { UpdateTransactionDto } from './dto/user/update-transaction.dto';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import {
  Transaction,
  TransactionDocument,
  TransactionType,
  TransactionStatus,
} from 'src/schemas/Transaction.schema';
import {
  TimeDashboardType,
  DashboardDto,
} from './dto/admin/get-info-dashboard.dto';
import { FindTransactionDto } from './dto/admin/find-transaction.dto';
import mongoose from 'mongoose';
import { Utils } from 'src/common/utils';
import {
  CacheKeyName,
  ErrorCode,
  FIX_FLOATING_POINT,
} from 'src/common/constants';
import { CommonService } from 'src/common-service/common.service';
import * as moment from 'moment';
import { RecoverTransactionDto } from './dto/admin/recover-transaction.dto';
import { UserJWT } from 'src/auth/role.enum';
import { ApiError } from 'src/common/api';
import {
  Redemption,
  RedemptionDocument,
  RedemptionStatus,
} from 'src/schemas/Redemption.schema';
import { Owner, OwnerDocument, OwnerStatus } from 'src/schemas/Owner.schema';
import { Web3ETH } from 'src/blockchain/web3.eth';

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
    @InjectModel(Redemption.name)
    private redemptionModel: Model<RedemptionDocument>,
  ) {}

  async findAll(requestData: FindTransactionDto) {
    const userSystem = await this.commonService.userWithRoleCompany();
    const conditionAnd: mongoose.FilterQuery<TransactionDocument>[] = [
      {
        status: TransactionStatus.SUCCESS,
        type: TransactionType.MINTED,
      },
    ];
    // Search by buyer, referrer, bda, event name
    if (requestData?.keyword) {
      const constidionOr: mongoose.FilterQuery<TransactionDocument>[] = [
        { toAddress: { $regex: requestData.keyword, $options: 'i' } },
        {
          'affiliateInfor.referrerDirect.address': {
            $regex: requestData.keyword,
            $options: 'i',
          },
        },
        {
          'affiliateInfor.bda.address': {
            $regex: requestData.keyword,
            $options: 'i',
          },
        },
        {
          'event.name': {
            $regex: requestData.keyword,
            $options: 'i',
          },
        },
      ];
      conditionAnd.push({ $or: constidionOr });
    }

    if (requestData?.startDate) {
      conditionAnd.push({
        createdAt: { $gte: new Date(requestData.startDate) },
      });
    }

    if (requestData?.endDate) {
      conditionAnd.push({
        createdAt: { $lte: new Date(requestData.endDate) },
      });
    }

    if (requestData?.nftIds) {
      conditionAnd.push({
        'nft.id': { $in: requestData.nftIds },
      });
    }

    if (requestData?.userReferrals) {
      conditionAnd.push({
        'affiliateInfor.referrerDirect.address': { $ne: userSystem.address },
      });
    }

    const pipe: mongoose.PipelineStage[] = [
      {
        $match: {
          $and: conditionAnd,
        },
      },
      {
        $project: {
          transactionDate: '$createdAt',
          buyer: '$toAddress',
          nft: {
            id: '$nft.id',
            name: '$nft.name',
            image: '$nft.image',
            cid: '$nft.token.cid',
            noOfShare: '$nft.noOfShare',
          },
          unitPrice: '$event.category.unitPrice',
          quantity: 1,
          subTotal: '$revenue',
          adminEarning: 1,
          affiliateInfor: 1,
          event: 1,
          hash: 1,
        },
      },
    ];

    const result = await Utils.aggregatePaginate(
      this.transactionModel,
      pipe,
      requestData,
    );

    const revenueOverview = await this.transactionModel.aggregate([
      {
        $match: {
          $and: conditionAnd,
        },
      },
      {
        $group: {
          _id: null,
          totalVolume: { $sum: '$revenue' },
          totalEarnings: { $sum: { $toDecimal: '$adminEarning' } },
          totalTokensSold: { $sum: '$quantity' },
        },
      },
      { $unset: ['_id'] },
    ]);
    return {
      ...result,
      ...revenueOverview[0],
      totalTransactions: result?.totalDocs || 0,
    };
  }

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
    const redemptionInfo = await this.redemptionModel.aggregate([
      { $unwind: '$items' },
      {
        $match: {
          nftId,
          tokenId: faultyToken,
          status: RedemptionStatus.REDEEMED,
        },
      },
    ]);
    if (redemptionInfo?.length > 0) {
      throw ApiError();
    }
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
    const signature = await this.commonService.getRecoverDataSignature(data);

    return this.transactionModel.create({
      _id: transactionId,
      nft: this.commonService.convertToSimpleNFT(nft),
      type: TransactionType.RECOVER,
      fromAddress: user.address,
      toAddress: recipientAddress,
      quantity: 1,
      status: TransactionStatus.DRAFT,
      signature,
      faultyToken,
    });
  }

  async validateFieldsWhenRecovering(
    user: UserJWT,
    body: RecoverTransactionDto,
  ) {
    const web3ETH = new Web3ETH();
    const tokenInfo = await this.ownerModel.findOne({
      tokenId: body.faultyToken,
      nftId: Utils.toObjectId(body.nftId),
    });
    if (!tokenInfo) {
      throw ApiError(
        ErrorCode.NO_TOKEN_EXISTS,
        `Faulty token has not existence`,
      );
    }

    if (tokenInfo.status === OwnerStatus.INVALID) {
      throw ApiError(
        ErrorCode.TOKEN_IS_INVALID,
        `Faulty token has been marked as invalid`,
      );
    }

    if (tokenInfo.status === OwnerStatus.BURNED) {
      throw ApiError(ErrorCode.TOKEN_IS_INVALID, `Faulty token has been burnt`);
    }

    if (!web3ETH.checkAddress(body.recipientAddress)) {
      throw ApiError(ErrorCode.INVALID_ADDRESS, 'Invalid address');
    }
  }
}

import { ConsoleLogger, Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import {
  NFT,
  NFTDocument,
  NFTStatus,
  Token,
  TokenStandard,
  OwnerStatus,
} from 'src/schemas/NFT.schema';
import { CreateNftDto } from './dto/admin/create-nft.dto';
import { UpdateNftDto } from './dto/admin/update-nft.dto';
import { NftsModule } from './nfts.module';
import { Model } from 'mongoose';
import { CounterName } from 'src/schemas/Counter.schema';
import { AwsUtils } from 'src/common/aws.util';
import mongoose from 'mongoose';
import ObjectID from 'bson-objectid';
import { ErrorCode, FIX_FLOATING_POINT } from 'src/common/constants';
import { Utils } from 'src/common/utils';
import {
  Transaction,
  TransactionDocument,
  TransactionStatus,
  TransactionType,
} from 'src/schemas/Transaction.schema';
import { ApiError } from 'src/common/api';
import { FindNftDto, NftType, OnSaleStatus } from './dto/admin/find-nft.dto';
import { SearchDto } from 'src/common/search.dto';
import { FindTransactionDto } from './dto/admin/find-transaction.dto';
import BigNumber from 'bignumber.js';
import {
  Notification,
  NotificationDocument,
} from 'src/schemas/Notification.schema';
import slugify from 'slugify';
import { FindOwnerDto } from './dto/admin/find-owner.dto';
import { CommonService } from 'src/common-service/common.service';
import { Owner, OwnerDocument } from 'src/schemas/Owner.schema';

@Injectable()
export class NftsAdminService {
  private readonly logger = new Logger(NftsAdminService.name);

  constructor(
    @InjectConnection() private readonly connection: mongoose.Connection,
    @InjectModel(NFT.name)
    private nftModel: Model<NFTDocument>,
    @InjectModel(Transaction.name)
    private transactionModel: Model<TransactionDocument>,
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    private commonService: CommonService,
    @InjectModel(Owner.name)
    private ownerModel: Model<OwnerDocument>,
  ) {}

  getImagePath(nftCode: string) {
    return `nft/${nftCode}/img`;
  }

  getImageMediumPath(nftCode: string) {
    return `nft/${nftCode}/img-medium`;
  }

  getImageSmallPath(nftCode: string) {
    return `nft/${nftCode}/img-small`;
  }

  getMediaPath(nftCode: string) {
    return `nft/${nftCode}/media`;
  }

  async findAll(requestData: FindNftDto) {
    const conditionAnd: mongoose.FilterQuery<NFTDocument>[] = [];
    // Search by name, code, tokenIds
    const constidionOr: mongoose.FilterQuery<NFTDocument>[] = [
      { name: { $regex: requestData.keyword, $options: 'i' } },
      { 'token.ids': { $in: [requestData.keyword] } },
    ];
    conditionAnd.push({
      $or: constidionOr,
      isDeleted: false,
    });
    // Search by status
    if (requestData.status) {
      conditionAnd.push({ status: requestData.status });
    }

    if (requestData.isWithoutBlack === NftType.WITHOUT_BLACK) {
      conditionAnd.push({ isNFTBlack: false });
    }

    if (requestData.isWithoutBlack === NftType.ONLY_BLACK) {
      conditionAnd.push({ isNFTBlack: true });
    }

    if (requestData.ableToSale === OnSaleStatus.ABLE) {
      conditionAnd.push({ 'token.totalAvailable': { $gt: 0 } });
    }

    const pipe: mongoose.PipelineStage[] = [
      {
        $match: {
          $and: conditionAnd,
        },
      },
      {
        $project: {
          name: 1,
          code: 1,
          image: 1,
          totalSupply: '$token.totalSupply',
          totalMinted: '$token.totalMinted',
          totalAvailable: '$token.totalAvailable',
          onSaleQuantity: {
            $cond: [
              '$isNFTBlack',
              0,
              {
                $subtract: [
                  '$token.totalSupply',
                  {
                    $add: ['$token.totalAvailable', '$token.totalMinted'],
                  },
                ],
              },
            ],
          },
          noOfShare: 1,
          status: 1,
          createdAt: 1,
          totalBurned: '$token.totalBurnt',
          isNFTBlack: 1,
        },
      },
    ];

    return Utils.aggregatePaginate(this.nftModel, pipe, requestData);
  }

  async findOne(id: string, requestData: SearchDto) {
    const eventInfo = await this.commonService.getEventInfoByNFTId(
      id,
      requestData,
    );
    const pipeLine = [
      {
        $match: {
          _id: Utils.toObjectId(id),
        },
      },
      {
        $set: {
          onSaleQuantity: {
            $cond: [
              '$isNFTBlack',
              0,
              {
                $subtract: [
                  '$token.totalSupply',
                  {
                    $add: ['$token.totalAvailable', '$token.totalMinted'],
                  },
                ],
              },
            ],
          },
          totalBurned: { $sum: '$token.totalBurnt' },
        },
      },
    ];

    const result = await Utils.aggregatePaginate(this.nftModel, pipeLine, null);
    result.events = eventInfo?.docs;
    return result;
  }

  async findOwner(id: string, requestData: FindOwnerDto) {
    const andCondition: mongoose.FilterQuery<NFTDocument>[] = [
      {
        _id: Utils.toObjectId(id),
      },
    ];
    if (requestData?.keyword) {
      const orCondition = {
        $or: [
          {
            'owners.mintedAddress': Utils.formatAddress(
              requestData.keyword.trim(),
            ),
          },
          {
            'owners.address': Utils.formatAddress(requestData.keyword.trim()),
          },
          {
            'owners.event.name': {
              $regex: requestData.keyword.trim(),
              $options: 'i',
            },
          },
          {
            'owners.tokenId': requestData.keyword.trim(),
          },
        ],
      };
      andCondition.push(orCondition);
    }

    if (requestData?.startDate) {
      andCondition.push({
        'owners.mintedDate': { $gte: new Date(requestData.startDate) },
      });
    }

    if (requestData?.endDate) {
      andCondition.push({
        'owners.mintedDate': { $lte: new Date(requestData?.endDate) },
      });
    }

    if (requestData?.status) {
      andCondition.push({
        'owners.status': requestData?.status,
      });
    }

    if (requestData?.isBurned) {
      andCondition.push({
        'owners.status': OwnerStatus.BURNED,
      });
    }
    const pipe: mongoose.PipelineStage[] = [
      {
        $lookup: {
          from: 'owners',
          localField: '_id',
          foreignField: 'nftId',
          as: 'owners',
        },
      },
      { $unwind: '$owners' },
      {
        $match: { $and: andCondition },
      },
      {
        $addFields: {
          lockingBalance: {
            $cond: [
              { $eq: ['$owners.status', OwnerStatus.UNLOCKED] },
              '$owners.lockingBalance',
              {
                $add: [
                  { $subtract: ['$$NOW', '$owners.lastLockDate'] },
                  '$owners.lockingBalance',
                ],
              },
            ],
          },
        },
      },
    ];

    const result = await Utils.aggregatePaginate(
      this.nftModel,
      pipe,
      requestData,
    );
    return result;
  }

  async addSupplyNft(id: string, { newTotalSupply }) {
    const nft = await this.commonService.findNFTById(id);
    const supplyQuantity = newTotalSupply - nft.token.totalSupply;
    if (supplyQuantity <= 0)
      throw ApiError(
        ErrorCode.NUMBER_MUST_GREATER,
        `New total supply must be larger than ${nft.token.totalSupply}`,
      );
    const update = {};

    if (nft.status === NFTStatus.SOLD_OUT) {
      update['status'] = NFTStatus.OFF_SALE;
    }
    update['token.totalSupply'] = newTotalSupply;
    update['$inc'] = { 'token.totalAvailable': +supplyQuantity };
    update['$push'] = {
      'token.historySupply': {
        oldTotalSupply: nft.token.totalSupply,
        newTotalSupply: newTotalSupply,
        date: new Date(),
      },
    };
    await this.nftModel.updateOne({ _id: id }, update);

    return true;
  }

  async getDetailTokenId(tokenId: string) {
    const result = await this.commonService.getTokensInfoDetailByTokenId(
      tokenId,
    );
    let lockingBalance;
    if (result) {
      const { status, lastLockDate } = result;
      if (status === OwnerStatus.LOCKED) {
        lockingBalance =
          new Date().getTime() -
          new Date(lastLockDate).getTime() +
          result.lockingBalance;
      } else if (
        status === OwnerStatus.UNLOCKED ||
        status === OwnerStatus.INVALID
      ) {
        lockingBalance = result.lockingBalance;
      }
    }
    return { ...result?.toObject(), lockingBalance };
  }

  async createNftTest() {
    const createdNft = new this.nftModel();
    createdNft.name = 'Name Thang';
    createdNft.description = 'Description Thang Test ';
    createdNft.creatorAddress = 'Address Thang Test';
    const nft = await this.nftModel.findOne({ name: 'Yellow Diamond Vault' });
    createdNft.image = nft.image;
    await createdNft.save();
    return createdNft;
  }
}

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
    // if (requestData.status) {
    //   conditionAnd.push({ status: requestData.status });
    // }

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
            $subtract: [
              '$token.totalSupply',
              {
                $add: ['$token.totalAvailable', '$token.totalMinted'],
              },
            ],
          },
          status: 1,
          createdAt: 1,
          totalBurned: '$token.totalBurnt',
        },
      },
    ];

    return Utils.aggregatePaginate(this.nftModel, pipe, requestData);
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

    await this.nftModel.updateOne({ _id: id }, update);

    return true;
  }

  async getDetailTokenId(tokenId: string) {
    const result = await this.commonService.getTokensInfoDetailByTokenId(
      tokenId,
    );

    return { ...result?.toObject() };
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

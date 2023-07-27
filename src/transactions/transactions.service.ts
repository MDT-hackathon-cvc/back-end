import { Injectable, Logger } from '@nestjs/common';
import { CreateTransactionDto } from './dto/user/create-transaction.dto';
import { UpdateTransactionDto } from './dto/user/update-transaction.dto';
import { Model } from 'mongoose';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import {
  Transaction,
  TransactionDocument,
  TransactionStatus,
  TransactionType,
} from 'src/schemas/Transaction.schema';
import { FindPurchaseHistoryDto } from './dto/user/find-purchase-history.dto';
import { UserJWT } from 'src/auth/role.enum';
import mongoose from 'mongoose';
import { Utils } from 'src/common/utils';
import { ErrorCode, FIX_FLOATING_POINT } from 'src/common/constants';
import { ApiError } from 'src/common/api';
import { CommonService } from 'src/common-service/common.service';
import { UserRole } from 'src/schemas/User.schema';
import { UpdateTransactionHashDto } from './dto/user/update-transaction-hash.dto';

import { NFTStatus, Owner } from 'src/schemas/NFT.schema';
import { OwnerDocument, OwnerStatus } from 'src/schemas/Owner.schema';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectConnection() private readonly connection: mongoose.Connection,
    @InjectModel(Transaction.name)
    private transactionModel: Model<TransactionDocument>,
    private readonly commonService: CommonService,
    @InjectModel(Owner.name)
    private ownerModel: Model<OwnerDocument>,
  ) {}

  calculateTotalProfit(pipe: mongoose.PipelineStage[]) {
    return this.transactionModel.aggregate([
      ...pipe,
      {
        $group: {
          _id: 'null',
          total: {
            $sum: {
              $multiply: ['$profit', FIX_FLOATING_POINT],
            },
          },
        },
      },
    ]);
  }

  async validateCreateTransactionBuyNFT(
    requestData: CreateTransactionDto,
    user: UserJWT,
  ) {}

  async create(requestData: CreateTransactionDto, address?: string) {
    const { nftId, quantity, fromAddress, transactionHash, price, status } =
      requestData;
    const provider = this.commonService.getProvider(process.env.CHAIN_ID);
    while (true) {
      const dataPurchase = await provider.getTransactionReceipt(
        transactionHash,
      );
      if (dataPurchase.logs[1]) {
        const orderId = dataPurchase.logs[1].topics[1];
        let nft = await this.commonService.findNFTById(nftId);
        const transaction = {
          nft: {
            id: nft._id,
            name: nft.name,
            code: nft.code,
            slug: nft.slug,
            image: nft.ipfsImage,
          },
          type: TransactionType.BUY,
          fromAddress,
          toAddress: address,
          status: TransactionStatus.SUCCESS,
          hash: status === TransactionStatus.SUCCESS ? transactionHash : '',
          quantity,
          price,
          orderId,
        };
        
        nft.status = NFTStatus.OFF_SALE;
        nft.orderId = '';
        await Promise.all([
          nft.save(),
          this.commonService.updateOwnerAfterBuy({ nft, address })
        ])
        

        return (await this.transactionModel.create(transaction)).save();
      }
    }
  }

  async findPurchaseHistories(
    requestData: FindPurchaseHistoryDto,
    user: UserJWT,
  ) {
    const { keyword, endDate, startDate, nftIds, sort, page, limit } =
      requestData;
    const conditionAnd: mongoose.FilterQuery<TransactionDocument>[] = [];

    conditionAnd.push(
      {
        status: TransactionStatus.SUCCESS,
      },
      {
        type: TransactionType.BUY,
      },
      {
        toAddress: {
          $regex: user.address,
          $options: 'i',
        },
      },
    );

    if (startDate) {
      conditionAnd.push({
        createdAt: {
          $gte: new Date(startDate),
        },
      });
    }
    if (endDate) {
      conditionAnd.push({
        createdAt: {
          $lte: new Date(endDate),
        },
      });
    }
    if (nftIds) {
      conditionAnd.push({
        'nft.id': {
          $in: nftIds,
        },
      });
    }

    if (sort) sort[Object.keys(sort)[0]] = +sort[Object.keys(sort)[0]];

    const sortCustom: mongoose.FilterQuery<TransactionDocument> = sort || {
      createdAt: -1,
    };
    const pipe: mongoose.PipelineStage[] = [
      {
        $match: {
          $and: conditionAnd,
        },
      },
      {
        $project: {
          _id: 1,
          createdAt: 1,
          item: {
            id: '$nft.id',
            name: '$nft.name',
            image: '$nft.image',
            code: '$nft.code',
          },
          quantity: 1,
          hash: 1,
          status: 1,
          type: 1,
          toAddress: 1,
          price: 1,
          orderId: 1,
        },
      },
      {
        $facet: {
          metadata: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                totalSpending: { $sum: '$subTotal' },
              },
            },
          ],
          data: [
            { $sort: sortCustom },
            { $skip: page * limit || 0 },
            { $limit: limit || 10 },
          ],
        },
      },
    ];

    const result = await this.transactionModel
      .aggregate(pipe)
      .collation({ locale: 'en' });
    return result;
  }

  findOne(id: string) {
    return this.commonService.findTransactionById(id);
  }

  async update(
    req: any,
    id: string,
    requestData: UpdateTransactionDto,
    isFromPartner = false,
  ) {
    const transaction = await this.commonService.findTransactionById(id);
    const user: UserJWT = req?.user;
    this.validatePermissionUpdateTransaction(transaction, user);
    switch (requestData.status) {
      case TransactionStatus.CANCEL:
      case TransactionStatus.FAILED:
        return this.updateCancelTransaction(req, transaction, requestData);
    }
  }

  async updateTransactionHash(
    id: string,
    requestData: UpdateTransactionHashDto,
    user: UserJWT,
  ) {
    if (!Utils.isValidateHash(requestData.hash)) {
      throw ApiError(ErrorCode.INVALID_DATA, `Transaction hash is invalid`);
    }

    // Update transaction hash
    const transaction = await this.commonService.findTransactionById(id);

    this.validatePermissionUpdateTransaction(transaction.type, user);

    transaction.hash = requestData.hash;
    transaction.status = TransactionStatus.PROCESSING;

    const session = await this.connection.startSession();
    await session.withTransaction(async () => {
      await transaction.save({ session });
    });
  }

  async getTotalMinter() {
    const transactions = await this.transactionModel.distinct('toAddress', {
      status: TransactionStatus.SUCCESS,
      type: TransactionType.MINTED,
    });
    return transactions.length;
  }

  async getSumVolumeNft() {
    const totalVolumes = await this.transactionModel.aggregate([
      {
        $match: {
          status: TransactionStatus.SUCCESS,
          type: TransactionType.MINTED,
        },
      },
      {
        $group: {
          _id: null,
          sumVolume: {
            $sum: '$revenueUsd',
          },
          sumQuantity: { $sum: '$quantity' },
        },
      },
    ]);

    return {
      sumVolume: totalVolumes.length > 0 ? totalVolumes[0].sumVolume : 0,
      sumQuantity: totalVolumes.length > 0 ? totalVolumes[0].sumQuantity : 0,
    };
  }

  validatePermissionUpdateTransaction(transaction, user) {
    switch (transaction.type) {
      case TransactionType.MINTED:
        if (user.address !== transaction.toAddress) {
          throw ApiError(
            ErrorCode.INVALID_DATA,
            `You don't have permission to update this transaction`,
          );
        }
        break;
      case TransactionType.TRANSFER:
        if (user.address !== transaction.toAddress) {
          throw ApiError(
            ErrorCode.INVALID_DATA,
            `You don't have permission to update this transaction`,
          );
        }
        break;
      case TransactionType.CANCELED:
        if (![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role)) {
          throw ApiError(
            ErrorCode.INVALID_DATA,
            `You must be administrator to update this transaction`,
          );
        }
        break;
      case TransactionType.ADMIN_MINTED:
        if (![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role)) {
          throw ApiError(
            ErrorCode.INVALID_DATA,
            `You must be administrator to update this transaction`,
          );
        }
        break;
      case TransactionType.ADMIN_SETTING:
        if (user.role !== UserRole.SUPER_ADMIN) {
          throw ApiError(
            ErrorCode.INVALID_DATA,
            `You must be super administrator to update this transaction`,
          );
        }
        break;
    }
  }

  async overview() {
    const [totalMinters, { sumVolume, sumQuantity }]: any = await Promise.all([
      this.getTotalMinter(),
      this.getSumVolumeNft(),
    ]);

    return {
      totalNft: sumQuantity,
      sumVolume,
      totalMinters,
    };
  }

  async updateCancelTransaction(
    req: any,
    transaction: TransactionDocument,
    requestData: UpdateTransactionDto,
  ) {
    transaction.hash = requestData.hash;
    let message;
    try {
      const error = JSON.parse(requestData.message);
      message = {
        userAgent: Utils.getUserAgent(req),
        ipAddress: Utils.getUserIP(req),
        error,
      };
    } catch (error) {
      message = requestData.message;
    }
    const promises = [];
    const session = await this.connection.startSession();
    await session.withTransaction(async () => {
      transaction.status = requestData.status;
      promises.push(transaction.save({ session }));
      this.commonService.updateAdminAfterTransactionFail(
        transaction,
        promises,
        session,
      );
      await Promise.all(promises);
    });

    await session.endSession();

    return transaction;
  }
}

import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
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
import {
  Contract,
  DEFAULT_CURRENCY_NAME,
  ErrorCode,
  FIX_FLOATING_POINT,
} from 'src/common/constants';
import BigNumber from 'bignumber.js';
import { ApiError } from 'src/common/api';
import { Web3Gateway } from 'src/blockchain/web3.gateway';
import { CommonService } from 'src/common-service/common.service';
import {
  AdminPermissions,
  UserRole,
  UserStatus,
} from 'src/schemas/User.schema';
import { UpdateTransactionHashDto } from './dto/user/update-transaction-hash.dto';
import {
  EventDocument,
  EventStatus,
  EventType,
} from 'src/schemas/Event.schema';

import { Owner } from 'src/schemas/NFT.schema';
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
  ) {
    if (user.role === UserRole.ADMIN) {
      throw ApiError(ErrorCode.INVALID_DATA, `admin can't buy a nft`);
    }
    const event = await this.commonService.findEventById(requestData.eventId);

    const category = await this.commonService.getCategoryInEvent(
      event,
      requestData.nftId,
    );

    const quantityNftRemain = category.quantityForSale - category.totalMinted;
    if (quantityNftRemain === 0) {
      throw ApiError(
        ErrorCode.UNSUCCESS_TRANSACTION,
        'Event have been sold out this nft',
      );
    }

    if (requestData.quantity && requestData.quantity > quantityNftRemain) {
      throw ApiError(
        ErrorCode.UNSUCCESS_TRANSACTION,
        'quantity must less than total supply of nft in event',
      );
    }
    if (event.creatorAddress === user.address) {
      throw ApiError(ErrorCode.UNSUCCESS_TRANSACTION, `Can't buy your nft`);
    }

    if (event.status !== EventStatus.LIVE) {
      throw ApiError(
        ErrorCode.UNSUCCESS_TRANSACTION,
        `Event is not for purchase`,
      );
    }

    if (event.status === EventStatus.LIVE && new Date() > event.endDate) {
      throw ApiError(ErrorCode.UNSUCCESS_TRANSACTION, `Event is out date`);
    }
    // prettier-ignore
    // check whilelist
    if(event.type === EventType.WHITE_LIST) {
      this.commonService.validateWhiteListWhenPurchase(event.whitelistInfo.address, user.address)
    }
  }

  async validateCreateTransaction(
    requestData: CreateTransactionDto,
    user: UserJWT,
  ) {
    switch (requestData.type) {
      case TransactionType.MINTED:
        return this.validateCreateTransactionBuyNFT(requestData, user);
      case TransactionType.TRANSFER:
        return this.validateCreateTransactionBuyNFT(requestData, user);
      case TransactionType.ADMIN_MINTED:
        return this.validateCreateTransactionAdminMint(requestData, user);
      default:
        break;
    }
  }

  // eslint-disable-next-line max-lines-per-function
  async createTransactionBuyNFT(
    requestData: CreateTransactionDto,
    user: UserJWT,
  ) {
    const event = await this.commonService.findEventById(requestData.eventId);
    const [signer, nft, currency, userInfor] = await Promise.all([
      this.commonService.findSigner(),
      this.commonService.findNFTById(requestData.nftId),
      this.commonService.findCurrency(DEFAULT_CURRENCY_NAME),
      this.commonService.findUserByAddress(user.address),
    ]);
    const categogyInEvent = this.commonService.getCategoryInEvent(
      event,
      nft._id,
    );

    // Create signature
    const transactionId = Utils.createObjectId();
    const price = Utils.convertPrice(
      categogyInEvent.unitPrice,
      currency.decimals,
    );
    const revenue = new BigNumber(
      categogyInEvent.unitPrice.toString(),
    ).multipliedBy(requestData.quantity);
    const revenueConvert = Utils.toDecimal(revenue.toString());
    const revenueUsd = Utils.toDecimal(
      revenue.multipliedBy(currency.usd).toString(),
    );
    // MINTED NFT
    // update admin earning

    const bdaOfBuyer = await this.commonService.getBDAOfUser(
      userInfor.originator,
    );
    const data = {
      referrer: user.referrer,
      signer: signer,
      nft: nft,
      quantityForSale: categogyInEvent.quantityForSale,
      price: price,
      quantity: requestData.quantity,
      transactionId: transactionId,
      event: event,
      toAddress: requestData.toAddress,
      bdaOfBuyer: bdaOfBuyer,
      currencyAddress: currency.address,
    };

    return this.transactionModel.create({
      _id: transactionId,
      nft: this.commonService.convertToSimpleNFT(nft),
      type: TransactionType.MINTED,
      fromAddress: event.creatorAddress,
      toAddress: user.address,
      quantity: requestData.quantity,
      status: TransactionStatus.DRAFT,
      signature: null,
      event: this.commonService.convertToSimpleEvent(event, categogyInEvent),
      revenue: revenueConvert,
      revenueUsd: revenueUsd,
      affiliateInfor:  {},
      adminEarning: null,
    });
  }

  async createTransactionCancelEvent(
    requestData: CreateTransactionDto,
    user: UserJWT,
  ) {
    const event = await this.commonService.findEventById(requestData.eventId);
    if (event.status !== EventStatus.COMING_SOON) {
      return ApiError();
    }
    const transactionId = Utils.createObjectId();
    const onSaleQuantity = event.categories.reduce(
      (preValue, currItem) =>
        preValue + currItem.quantityForSale - currItem.totalMinted,
      0,
    );
    const transaction = new this.transactionModel({
      _id: transactionId,
      nft: null,
      type: TransactionType.CANCELED,
      fromAddress: user.address,
      status: TransactionStatus.DRAFT,
      quantity: onSaleQuantity,
      event: this.commonService.convertToSimpleEvent(event, null),
    });
    // create signature
    const signature = await this.createSignatureTransactionForCancelEvent(
      event,
      transaction,
    );
    transaction.signature = signature;

    return transaction.save();
  }

  async createSignatureTransactionForCancelEvent(
    event: EventDocument,
    transaction: TransactionDocument,
  ) {
    const web3Gateway = new Web3Gateway();
    const dataToSign = [
      this.getActionCodeByTransactionType(TransactionType.CANCELED),
      event.signature.hash,
      Utils.formatMongoId(transaction._id),
    ];
    const signer = await this.commonService.findSigner();
    const signature = await web3Gateway.sign(dataToSign, signer.privateKey);
    const requestData = [
      Utils.convertDateToSeconds(event.startDate),
      Utils.convertDateToSeconds(event.endDate),
      event.creatorAddress,
      Utils.formatMongoId(event._id),
      Utils.formatMongoId(transaction._id),
      event.signature.hash,
      signature,
    ];
    return {
      address: signer.address,
      hash: signature,
      data: dataToSign,
      requestData: requestData,
    };
  }

  async createTransactionAdminMint(
    requestData: CreateTransactionDto,
    user: UserJWT,
  ) {
    const nft = await this.commonService.findNFTById(requestData.nftId);
    const transactionId = Utils.createObjectId();
    const signature = await this.commonService.getDataSignatureAdminMint(
      requestData.toAddress,
      nft.id,
      transactionId,
    );

    return this.transactionModel.create({
      _id: transactionId,
      nft: this.commonService.convertToSimpleNFT(nft),
      type: TransactionType.ADMIN_MINTED,
      toAddress: requestData.toAddress,
      quantity: requestData.quantity,
      status: TransactionStatus.DRAFT,
      signature: signature,
      adminMintedAddress: user.address,
    });
  }

  async create(requestData: CreateTransactionDto, user?: UserJWT) {
    // Validate
    await this.validateCreateTransaction(requestData, user);

    // Create transaction
    switch (requestData.type) {
      case TransactionType.MINTED:
        return this.createTransactionBuyNFT(requestData, user);
      case TransactionType.CANCELED:
        await this.commonService.updateStatusAdminAction(user.address);
        return this.createTransactionCancelEvent(requestData, user);
      case TransactionType.ADMIN_MINTED:
        await this.commonService.updateStatusAdminAction(user.address);
        return this.createTransactionAdminMint(requestData, user);
      case TransactionType.DEPOSIT:
        await this.commonService.updateStatusAdminAction(user.address);
        return this.createTransactionDeposit(
          requestData,
          user,
          TransactionType.DEPOSIT,
        );
    }
  }

  async createTransactionDeposit(
    requestData: CreateTransactionDto,
    user: UserJWT,
    type: TransactionType,
  ) {
    let result;
    const session = await this.connection.startSession();
    await session.withTransaction(async () => {
      const transactionId = Utils.createObjectId();
      const transaction = new this.transactionModel({
        _id: transactionId,
        type: type,
        status: TransactionStatus.DRAFT,
        depositAmount: Utils.toDecimal(requestData.depositAmount),
        fromAddress: user.address,
        affiliateInfor: null,
      });
      const signature = await this.createSignatureForDeposit(transaction);
      transaction.signature = signature;
      result = await transaction.save({ session: session });
    });
    await session.endSession();
    return result;
  }

  async createSignatureForDeposit(transaction: TransactionDocument) {
    const { _id, fromAddress, depositAmount } = transaction;
    const usdt = await this.commonService.findCurrency(DEFAULT_CURRENCY_NAME);
    const amount = Utils.convertPrice(depositAmount, usdt.decimals);
    const web3Gateway = new Web3Gateway();
    const dataToSign = [
      fromAddress,
      usdt.address,
      amount,
      Utils.formatMongoId(_id),
    ];
    const signer = await this.commonService.findSigner();
    const signature = await web3Gateway.sign(dataToSign, signer.privateKey);
    const requestData = [
      usdt.address,
      amount,
      Utils.formatMongoId(_id),
      signature,
    ];
    return {
      address: signer.address,
      hash: signature,
      data: dataToSign,
      requestData: requestData,
    };
  }


  getActionCodeByTransactionType(type: TransactionType) {
    const {
      CONTRACT_CANCEL_REDEMPTION_CODE,
      CONTRACT_SUBMIT_REDEMPTION_CODE,
      CONTRACT_APPROVE_REDEMPTION_CODE,
      CONTRACT_CANCEL_EVENT_CODE,
    } = process.env;
    switch (type) {
      case TransactionType.CREATE_REDEMPTION:
        return CONTRACT_SUBMIT_REDEMPTION_CODE;
      case TransactionType.CANCEL_REDEMPTION:
        return CONTRACT_CANCEL_REDEMPTION_CODE;
      case TransactionType.APPROVE_REDEMPTION:
        return CONTRACT_APPROVE_REDEMPTION_CODE;
      case TransactionType.CANCELED:
        return CONTRACT_CANCEL_EVENT_CODE;
      default: {
        break;
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
        type: TransactionType.MINTED,
      },
      {
        toAddress: {
          $regex: user.address,
          $options: 'i',
        },
      },
    );

    if (keyword) {
      conditionAnd.push({
        'event.name': {
          $regex: requestData.keyword,
          $options: 'i',
        },
      });
    }

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
          eventId: '$event.id',
          eventName: '$event.name',
          eventImg: '$event.imgUrl',
          item: {
            id: '$nft.id',
            name: '$nft.name',
            image: '$nft.image',
            totalSupply: '$nft.token.totalSupply',
            noOfShare: '$event.category.noOfShare',
            description: '$nft.description',
          },
          quantity: 1,
          subTotal: '$revenue',
          hash: 1,
          reffrer: '$affiliateInfor.referrerDirect.address',
          status: 1,
          type: 1,
          toAddress: 1,
          unitPrice: '$event.category.unitPrice',
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
      case TransactionStatus.SUCCESS:
        return this.updateSuccessTransaction(req, transaction, requestData);
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
      switch (transaction.type) {
        case TransactionType.ADMIN_SETTING:
          const admin = transaction.dataAdminTemp;
          await this.commonService.createAdmin(admin, session);
          break;
        case TransactionType.ADMIN_DELETE:
          const address = transaction.dataAdminTemp?.address;
          const adminDelete = await this.commonService.findUserByAddress(
            address,
          );
          adminDelete.isDeleted = true;
          await adminDelete.save({ session });
          break;
        case TransactionType.ADMIN_ACTIVE:
        case TransactionType.ADMIN_DEACTIVE:
          const { adminName } = transaction.dataAdminTemp;
          const adminUpdateStatus = await this.commonService.findUserByAddress(
            transaction.dataAdminTemp?.address,
          );
          if (adminName) adminUpdateStatus.adminName = adminName;
          adminUpdateStatus.status = UserStatus.PROCESSING;
          await adminUpdateStatus.save({ session });
          break;
      }
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
      transaction.message = message?.error?.message;
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

  async updateSuccessTransaction(
    req: any,
    transaction: TransactionDocument,
    requestData: UpdateTransactionDto,
  ) {
    const web3Gateway = new Web3Gateway();
    let transactionEvent;
    try {
      transactionEvent = await web3Gateway.getEventByHash(requestData.hash);
    } catch (error) {
      console.log('start date: ', new Date());
      await new Promise((resolve) => setTimeout(resolve, 10000));
      console.log('end date: ', new Date());
      const transdb = await this.transactionModel
        .findOne({ hash: requestData.hash })
        .lean();
      if (transdb && transdb.status === TransactionStatus.SUCCESS) {
        return;
      }
      this.logger.error('update(): transactionEvent', transactionEvent);
      if (transaction.type === TransactionType.RECOVER) {
        throw ApiError();
      } else {
        throw ApiError(
          ErrorCode.UNSUCCESS_TRANSACTION,
          'transaction hash is not valid',
        );
      }
    }
    switch (transaction.type) {
      case TransactionType.MINTED:
        return this.handleMintedTransaction(
          transactionEvent,
          requestData,
          transaction.id,
        );
      case TransactionType.ADMIN_MINTED:
        return this.handleAdminMintedTransaction(
          transactionEvent,
          requestData,
          transaction.id,
        );
      case TransactionType.APPROVE_REDEMPTION:
      case TransactionType.CANCEL_REDEMPTION:
      case TransactionType.CANCELED:
        return this.commonService.cancelEvent(transaction, requestData);
      case TransactionType.DEPOSIT:
        return this.commonService.deposit(transaction, requestData);
      case TransactionType.ADMIN_UPDATE:
      case TransactionType.ADMIN_ACTIVE:
      case TransactionType.ADMIN_DEACTIVE:
      case TransactionType.ADMIN_DELETE:
      case TransactionType.ADMIN_SETTING:
        return this.commonService.updateAdminAction(transaction, requestData);
    }
  }

  async handleMintedTransaction(
    transactionEvent: any,
    requestData: UpdateTransactionDto,
    id: string,
  ) {
    if (transactionEvent.name === Contract.EVENT.MINT_NFT) {
      const tokenIds = transactionEvent.tokenIds;
      return this.commonService.buyNFT(id, requestData, tokenIds);
    }
  }

  async handleAdminMintedTransaction(
    transactionEvent: any,
    requestData: UpdateTransactionDto,
    id: string,
  ) {
    if (transactionEvent.name === Contract.EVENT.ADMIN_MINT_NFT) {
      const tokenIds = [transactionEvent.tokenId];
      return this.commonService.adminMintNFT(id, requestData, tokenIds);
    }
  }


  async validateCreateTransactionAdminMint(
    requestData: CreateTransactionDto,
    user: UserJWT,
  ) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException();
    }

    const permissions = await this.commonService.getPermissionsOfAdmin(
      user.address,
    );
    if (
      !permissions.includes(AdminPermissions.NFT_MANAGEMENT) &&
      !permissions.includes(AdminPermissions.USER_MANAGEMENT)
    ) {
      throw new ForbiddenException();
    }

    const isReceiverBda = await this.commonService.checkBda(
      requestData.toAddress,
    );
    if (!isReceiverBda) {
      throw ApiError(ErrorCode.USER_NOT_BDA, 'receiver is not a BDA');
    }

    const countNftBlack = await this.commonService.countNftBlacks(
      requestData.toAddress,
      false,
    );
    if (countNftBlack === 1) {
      throw ApiError(
        ErrorCode.USER_HAD_NFT_BLACK,
        'A BDA just have only one NFT black admin minted!',
      );
    }
    return;
  }
}

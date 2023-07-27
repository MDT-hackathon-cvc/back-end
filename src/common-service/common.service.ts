import { OwnerStatus } from './../schemas/NFT.schema';
import {
  CACHE_MANAGER,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ApiError } from 'src/common/api';
import {
  CacheKeyName,
  CONFIG_TO_BECOME_BDA,
  Contract,
  ErrorCode,
  MIMEType,
  ROLE_NOTI,
} from 'src/common/constants';
import {
  NFT,
  NFTDocument,
  NFTStatus,
  Owner,
  SimpleNFT,
  SimpleToken,
  TokenStandard,
} from 'src/schemas/NFT.schema';
import {
  Transaction,
  TransactionDocument,
  TransactionStatus,
  TransactionType,
} from 'src/schemas/Transaction.schema';
import {
  AttributeType,
  Config,
  ConfigDocument,
  Currency,
  SimpleCurrency,
} from 'src/schemas/Config.schema';
import { Utils } from 'src/common/utils';
import { Counter, CounterDocument } from 'src/schemas/Counter.schema';
import mongoose from 'mongoose';
import { Lock, LockDocument, LockType } from 'src/schemas/Lock.schema';
import { Cache, CachingConfig } from 'cache-manager';
import { UpdateTransactionDto } from 'src/transactions/dto/user/update-transaction.dto';
import BigNumber from 'bignumber.js';
import { SocketGateway } from 'src/providers/socket/socket.gateway';
import {
  Content,
  Notification,
  NotificationDocument,
  NotificationType,
} from 'src/schemas/Notification.schema';
import { SOCKET_EVENT, SOCKET_ROOM } from 'src/providers/socket/socket.enum';
import {
  AdminPermissions,
  User,
  UserDocument,
  UserRole,
  UserStatus,
  UserType,
} from 'src/schemas/User.schema';
import { AwsUtils } from 'src/common/aws.util';
import { TransferDto } from 'src/providers/worker/dto/transfer.dto';
import {
  TransactionTransfer,
  TransactionTransferDocument,
  TransactionTransferStatus,
} from 'src/schemas/TransactionTransfer.schema';
import {
  TransactionTransferSync,
  TransactionTransferSyncDocument,
} from 'src/schemas/TransactionTransferSync.schema';

import ObjectID from 'bson-objectid';
import axios from 'axios';
import { SingleCandidateDto } from 'src/users/dto/kyc-user.dto';
import { OwnerDocument } from 'src/schemas/Owner.schema';
import {
  LockHistory,
  LockHistoryDocument,
} from 'src/schemas/LockHistory.schema';
import { PushNotificationDto } from 'src/notifications/dto/push-notification.dto';
import { UserJWT } from 'src/auth/role.enum';
import { ethers } from 'ethers';

export enum ActionType {
  REDEMPTION = 1,
  TRANSFER_NFT = 2,
  TRANSFER_BLACK_NFT = 3,
}
@Injectable()
export class CommonService implements OnModuleInit {
  private readonly logger = new Logger(CommonService.name);

  constructor(
    @InjectConnection() private readonly connection: mongoose.Connection,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectModel(Config.name) private configModel: Model<ConfigDocument>,
    @InjectModel(Counter.name) private counterModel: Model<CounterDocument>,
    @InjectModel(Lock.name) private lockModel: Model<LockDocument>,
    @InjectModel(NFT.name)
    private nftModel: Model<NFTDocument>,

    @InjectModel(Transaction.name)
    private transactionModel: Model<TransactionDocument>,

    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,

    @InjectModel(User.name)
    private userModel: Model<UserDocument>,

    @InjectModel(TransactionTransferSync.name)
    private transactionTransferSyncModel: Model<TransactionTransferSyncDocument>,

    @InjectModel(TransactionTransfer.name)
    private transactionTransferModel: Model<TransactionTransferDocument>,
    private socketGateway: SocketGateway,

    @InjectModel(LockHistory.name)
    private lockHistoryModel: Model<LockHistoryDocument>,

    @InjectModel(Owner.name)
    private ownerModel: Model<OwnerDocument>,
  ) {}

  async onModuleInit() {}

  async clearCacheNFT(transaction: TransactionDocument) {
    this.logger.log(`clearCacheNFT(): Clear cache NFT ${transaction.nft.id}`);
    const promises = [];

    promises.push(this.clearCacheNFTById(transaction.nft.id.toString()));

    if (
      transaction.toAddress &&
      transaction.toAddress !== Contract.ZERO_ADDRESS
    ) {
      promises.push(this.clearCacheNFTByAddress(transaction.toAddress));
      promises.push(
        this.clearCacheNFTByAddressAndNFT(
          transaction.toAddress,
          transaction.nft.id.toString(),
        ),
      );
    }
    if (
      (transaction.type === TransactionType.TRANSFER ||
        transaction.type === TransactionType.TRANSFER_OUTSIDE) &&
      transaction.fromAddress
    ) {
      promises.push(this.clearCacheNFTByAddress(transaction.fromAddress));
      promises.push(
        this.clearCacheNFTByAddressAndNFT(
          transaction.fromAddress,
          transaction.nft.id.toString(),
        ),
      );
    }

    await Promise.all(promises);
  }

  async clearCacheNFTById(id: string) {
    try {
      const cacheName = CacheKeyName.GET_TOKENS_BY_NFT(id);
      this.logger.log(`clearCacheNFT(): ${cacheName}`);
      await this.cacheManager.del(cacheName);
    } catch (error) {
      this.logger.warn(`clearCacheNFT(): error`, error);
    }
  }

  async clearCacheNFTByAddress(address) {
    try {
      const cacheName = CacheKeyName.GET_TOKEN_BY_ADDRESS(address);
      this.logger.log(`clearCacheNFTByAddress(): ${cacheName}`);
      await this.cacheManager.del(cacheName);
    } catch (error) {
      this.logger.warn(`clearCacheNFTByAddress(): error`, error);
    }
  }

  async clearCacheNFTByAddressAndNFT(address, nftId) {
    try {
      const cacheName = CacheKeyName.GET_TOKEN_BY_ADDRESS_AND_NFT(
        address,
        nftId,
      );
      this.logger.log(`clearCacheNFTByAddressAndNFT(): ${cacheName}`);
      await this.cacheManager.del(cacheName);
    } catch (error) {
      this.logger.warn(`clearCacheNFTByAddressAndNFT(): error`, error);
    }
  }

  async clearCacheConfig() {
    await Promise.all([
      this.cacheManager.del(CacheKeyName.GET_CONFIG.NAME),
      this.cacheManager.del(CacheKeyName.GET_FULL_CONFIG.NAME),
    ]);
  }

  async clearCache() {
    for (const [key, value] of Object.entries(CacheKeyName)) {
      try {
        const cacheName = CacheKeyName[key]['NAME'];
        await this.cacheManager.del(cacheName);
      } catch (error) {
        this.logError(error);
      }
    }
  }

  async setCache(key: string, data: any, options?: CachingConfig) {
    try {
      await this.cacheManager.set(key, data, options);
    } catch (error) {
      this.logError(error);
    }
  }

  getCache(key: string) {
    return this.cacheManager.get(key) as any;
  }

  async findConfig(address: string) {
    let config: any = await this.cacheManager.get(CacheKeyName.GET_CONFIG.NAME);
    if (!config) {
      config = await this.configModel.findOne(
        {},
        {
          attributes: 1,
          currencies: 1,
          ipfsGateway: 1,
          isMaintenance: 1,
          mintingQuantityMax: 1,
          userMintingQuantityMax: 1,
        },
      );
      const attributes = [];
      for (const [key, value] of Object.entries(config.attributes)) {
        const attribute: any = value;
        // attribute.name = key;
        delete attribute.display;
        attributes.push(attribute);
      }
      config.attributes = attributes;

      const currencies = [];
      for (const [key, value] of Object.entries(config.currencies)) {
        const currency: any = value;
        // currency.name = key;
        currencies.push(currency);
      }
      config.currencies = currencies;

      await this.cacheManager.set(CacheKeyName.GET_CONFIG.NAME, config, {
        ttl: CacheKeyName.GET_CONFIG.TTL,
      });
    }
    const [systems, admin] = await Promise.all([
      this.getAddressSystem(),
      this.findUserByAddress(address),
    ]);
    config.systems = systems;
    config.adminName = admin.adminName;
    return config;
  }

  async findFullConfig() {
    let config: any = await this.cacheManager.get(
      CacheKeyName.GET_FULL_CONFIG.NAME,
    );
    if (!config) {
      config = await this.configModel.findOne();
      await this.cacheManager.set(CacheKeyName.GET_FULL_CONFIG.NAME, config, {
        ttl: CacheKeyName.GET_FULL_CONFIG.TTL,
      });
    }
    config.systems = await this.getAddressSystem();
    return config;
  }

  async getAddressSystem() {
    const result = await this.userModel.aggregate([
      { $match: { role: UserRole.SYSTEM } },
    ]);
    return result.map((item: any) => item.address);
  }

  async findCurrencies() {
    const config = await this.findFullConfig();
    const currencies = [];
    for (const [key, value] of Object.entries(config.currencies)) {
      const currency: any = value;
      currencies.push(currency);
    }
    return currencies;
  }

  async findCurrency(currencyId: string) {
    const config = await this.findFullConfig();
    const currency = config.currencies[currencyId];
    if (!currency) {
      throw ApiError(ErrorCode.NO_DATA_EXISTS, `currency not found`);
    }
    return currency;
  }

  async findSigner() {
    const config = await this.findFullConfig();
    const privateKey = await Utils.decrypt(config.signer.privateKey);
    return {
      address: config.signer.address,
      privateKey,
    };
  }

  async findNextIndex(name: string, step = 1) {
    const counter = await this.counterModel.findOneAndUpdate(
      { name },
      {
        $inc: {
          index: step,
        },
      },
      {
        upsert: true,
        returnNewDocument: true,
      },
    );
    let currentIndex = 1;
    if (counter) {
      currentIndex = counter.index + 1;
    }
    return currentIndex.toString();
  }

  async findListIndex(name: string, step = 1) {
    const counter = await this.counterModel.findOneAndUpdate(
      { name },
      {
        $inc: {
          index: step,
        },
      },
      {
        upsert: true,
      },
    );
    let currentIndex = 0;
    if (counter) {
      currentIndex = counter.index;
    }
    const list = [];
    for (let index = currentIndex + 1; index <= currentIndex + step; index++) {
      list.push(index.toString());
    }
    return list;
  }

  logError(error: Error) {
    this.logger.error(error.message, error.stack);
  }

  async withLock(data: Partial<Lock>, fn: () => Promise<any>, retry = 1) {
    try {
      await this.lockDocument(data);

      const result = await fn();

      await this.releaseDocument(data);

      return result;
    } catch (error) {
      if (error.toString().indexOf('duplicate key error') > -1) {
        this.logger.warn(
          `${data.type}: Document ${data.documentId} was locked. Retry ${retry}`,
        );
        retry++;
        await Utils.wait(500);
        return this.withLock(data, fn, retry);
      }
      await this.releaseDocument(data);
      throw error;
    }
  }

  async lockDocument(data: Partial<Lock>): Promise<Lock> {
    // Delete old lock
    await this.lockModel.deleteMany({
      type: data.type,
      lockUntil: { $lt: new Date() },
    });

    // Lock
    const now = new Date();
    now.setSeconds(now.getSeconds() + 10);
    data.lockUntil = now;
    return await this.lockModel.create(data);
  }

  releaseDocument(data: Partial<Lock>) {
    return this.lockModel.deleteOne({
      type: data.type,
      documentId: data.documentId,
    });
  }

  async findNFTById(id: any) {
    const nft = await this.nftModel.findById(id);
    if (!nft) {
      throw ApiError(ErrorCode.NO_DATA_EXISTS, 'NFT not found');
    }
    if (nft.isDeleted) {
      throw ApiError(ErrorCode.NO_DATA_EXISTS, 'NFT has been deleted');
    }
    return nft;
  }
  async findNFTByIdV2(id: any) {
    const nft = await this.nftModel.findById(id);
    if (!nft) {
      throw ApiError(ErrorCode.NO_DATA_EXISTS, 'NFT not found');
    }
    return nft;
  }

  async findNFTBySlug(slug: string) {
    const nft = await this.nftModel.findOne({ slug });
    if (!nft) {
      throw ApiError(ErrorCode.NO_DATA_EXISTS, 'NFT not found');
    }
    if (nft.isDeleted) {
      throw ApiError(ErrorCode.NO_DATA_EXISTS, 'NFT has been deleted');
    }
    return nft;
  }

  async findNFTBy721TokenId(tokenId: any) {
    const nft = await this.nftModel.findOne({ 'token.ids': tokenId });
    return nft;
  }

  async findTransactionById(id: any) {
    const transaction = await this.transactionModel.findById(id);
    if (!transaction) {
      throw ApiError(ErrorCode.NO_DATA_EXISTS, 'Transaction not found');
    }
    return transaction;
  }

  async findTransactionByHashAndTokenId(tokenId: string, hash: string) {
    const transaction = await this.transactionModel.findOne({
      tokenIds: {
        $in: [tokenId],
      },
      hash,
    });
    return transaction;
  }

  async findUserByAddress(address: any) {
    const user = await this.userModel.findOne({
      address,
    });
    if (!user) {
      throw ApiError(ErrorCode.NO_DATA_EXISTS, 'User not found');
    }
    return user;
  }

  logPromise(promises: any[], results: any[]) {
    for (let index = 0; index < promises.length; index++) {
      const promise = promises[index];
      if (promise && promise.op && promise.op === 'updateOne') {
        if (
          results[index].matchedCount === 0
          // results[index].modifiedCount === 0
        ) {
          this.logger.debug(
            `logPromise(): updateOne ${promise.model.modelName}`,
            promise._conditions,
          );
          this.logger.debug(promise._update);
          this.logger.debug(results[index]);
          throw Error('logPromise(): Update fail');
        }
      }
    }
  }

  getMetaDataPath(nftCode: string) {
    return `nft/${nftCode}/meta-data`;
  }
  async getMetaData(nft: NFTDocument) {
    const image = nft.token.cid ? `ipfs://${nft.token.cid}` : nft.image.url;
    const metaData: any = {
      name: nft.name,
      description: nft.description,
      image,
      external_url: `${process.env.USER_SITE_URL}/nft/${nft._id}`,
      // attributes,
    };
    if (nft.media && nft.media.url) {
      const media = nft.token.cidMedia
        ? `ipfs://${nft.token.cidMedia}`
        : nft.media.url;
      metaData.animation_url = media;
    }
    return metaData;
  }
  async createMetaData(nft: NFTDocument) {
    const metaData = await this.getMetaData(nft);
    return AwsUtils.uploadS3(
      JSON.stringify(metaData),
      MIMEType.APPLICATION_JSON,
      this.getMetaDataPath(nft.code),
    );
  }

  deposit(transaction: TransactionDocument, requestData: UpdateTransactionDto) {
    return this.withLock(
      {
        type: LockType.DEPOSIT,
        documentId: transaction._id,
      },
      async () => {
        // Check transaction success
        const alreadyCompleted = this.checkTransactionAlreadyCompleted(
          transaction,
          requestData.isFromWorker,
        );
        if (alreadyCompleted.isAlreadyCompleted) {
          return alreadyCompleted;
        }
        const session = await this.connection.startSession();
        await session.withTransaction(async () => {
          const promises = [];
          // Update Transaction: status
          transaction.status = TransactionStatus.SUCCESS;
          transaction.hash = requestData.hash;

          promises.push(transaction.save({ session }));
          const results = await Promise.all(promises);
          this.logPromise(promises, results);
        });
        await session.endSession();
      },
    );
  }

  nftStatusAfterCancelingEvent(category: any, nft: any) {
    return category.quantityForSale +
      nft?.token?.totalAvailable +
      nft?.token?.totalBurnt ===
      nft.token?.totalSupply
      ? NFTStatus.OFF_SALE
      : NFTStatus.ON_SALE;
  }

  checkTransactionAlreadyCompleted(
    transaction: TransactionDocument,
    isFromWorker = false,
  ) {
    if (transaction.status === TransactionStatus.SUCCESS) {
      this.logger.log(
        `checkTransactionAlreadyCompleted(): ${transaction.id} is already completed`,
      );

      return {
        isAlreadyCompleted: true,
      };
    }
    return {
      isAlreadyCompleted: false,
    };
  }

  async countingOwnedTokenByUser(user: UserDocument) {
    const tokens = await this.ownerModel.find({
      address: user.address,
      status: {
        $in: [OwnerStatus.LOCKED, OwnerStatus.UNLOCKED, OwnerStatus.REDEEMED],
      },
    });
    return tokens?.length || 0;
  }

  /**
   * Checking a user who is able to caculate equity share
   * @Todo Missing condition: User must have black diamond
   * @param user: is a user model
   * @returns boolean
   */
  isAbleToCaculateEquityShare(user: any) {
    return user.userType === UserType.BDA && user.directReferee >= 3;
  }
  /**
   * Checking parents who has enough condition to caculate enquity shares or no
   * After that, update enquity share to these users
   * @param pathId: parents of user
   * @param transaction is a transaction model
   * @param session
   * @returns
   */

  /**
   * Caculating equity shares of a BDA
   * @param bda is user model has role is BDA
   * @param transaction: transaction model
   * @returns equity shares of BDA
   */

  /**
   * Caculating volume of user level 1 (excluding all children of this user and one)
   * @param directChildren: list user model is level 1
   * @param transaction: transaction model
   * @returns list total volume of users is level 1
   */
  getListChildVolume(directChildren: any[], transaction: any) {
    return directChildren.map(async (item) => {
      const children = await this.getChildrenOrDirectRefereeFromAddress(
        item.address,
      );
      children.push(item);
      const groupDirectVolume = await this.getGroupInfoByAddress(children);
      const addressChildren = children.map((element: any) => element.address);
      let totalVolume = new BigNumber(0);
      if (addressChildren.includes(transaction?.toAddress)) {
        totalVolume = new BigNumber(transaction?.revenue?.toString() || 0);
      }

      if (groupDirectVolume.length > 0) {
        const gropuInfo = groupDirectVolume[0];
        totalVolume = totalVolume.plus(gropuInfo?.totalVolume);
      }
      return { ...item, totalVolume: totalVolume.toString() };
    });
  }

  /**
   * Updating user infomation after this user become BDA
   * @param user is user model
   * @param session
   * @returns array promise contains users who is updated originator
   */
  updateUserBecomeBDA(user: UserDocument, session: any) {
    const promise = [];
    let pathIds: any[] = [];
    if (user.role === UserRole.SYSTEM) {
      pathIds.push(user.address);
    } else {
      pathIds = user.pathId;
    }
    promise.push(
      this.userModel.updateMany(
        {
          $and: [
            {
              pathId: {
                $elemMatch: { $regex: `^${user.address}$`, $options: 'i' },
              },
            },
            {
              isDeleted: false,
            },
            { originator: { $in: pathIds } },
          ],
        },
        {
          $set: {
            originator: user.address,
          },
        },
        {
          session,
        },
      ),
    );

    return promise;
  }

  async adminMintNFT(
    transactionId: string,
    requestData: UpdateTransactionDto,
    tokenIds: string[],
  ) {
    return this.withLock(
      {
        type: LockType.ADMIN_MINT_NFT,
        documentId: transactionId,
      },
      async () => {
        const transaction = await this.findTransactionById(transactionId);

        // Check transaction success
        const alreadyCompleted = this.checkTransactionAlreadyCompleted(
          transaction,
          requestData.isFromWorker,
        );
        if (alreadyCompleted.isAlreadyCompleted) {
          return alreadyCompleted;
        }

        // Clear cache
        await this.clearCacheNFT(transaction);

        const session = await this.connection.startSession();
        await session.withTransaction(async () => {
          const promises = [];
          // Update Transaction: status
          transaction.status = TransactionStatus.SUCCESS;
          transaction.hash = requestData.hash;

          promises.push(transaction.save({ session }));

          const nft = await this.nftModel.findById(transaction.nft.id);

          // Update NFT: status, token id, total supply, total minted

          // update user info when admin mints Black NFT to one
        });
        await session.endSession();
        // push noti

        return transaction;
      },
    );
  }

  async transferNFT(data: {
    nft: NFTDocument;
    transaction: TransactionDocument;
  }) {
    const { transaction } = data;
    const { fromAddress } = transaction;
    const nft = data.nft;

    // Clear cache
    await this.clearCacheNFT(transaction);

    const session = await this.connection.startSession();
    await session.withTransaction(async () => {
      const promises = [];
      try {
        // Transaction
        promises.push(transaction.save({ session }));
        // Update NFT: status, token id, total supply, total minted
      } catch (error) {
        await Promise.all(promises);
        throw error;
      }
      const results = await Promise.all(promises);
      this.logPromise(promises, results);
    });
    await session.endSession();
  }

  async transferNFT721(requestData: TransferDto) {
    if (
      Utils.formatAddress(requestData?.from) ===
        Utils.formatAddress(process.env.CONTRACT_LOCKING) ||
      Utils.formatAddress(requestData?.to) ===
        Utils.formatAddress(process.env.CONTRACT_LOCKING)
    ) {
      return;
    }
    return this.withLock(
      {
        type: LockType.TRANSFER_NFT,
        documentId: `${requestData.hash}-${requestData.tokenId}`,
      },
      async () => {
        const nft = await this.findNFTBy721TokenId(requestData.tokenId);
        if (!nft) {
          this.logger.error(`Not found NFT ${requestData.tokenId}`);
          return;
        }

        this.logger.log(
          `transferNFT721(): Transfer NFT ${nft.token.standard} ${nft.id} ${requestData.tokenId} from ${requestData.from} -> ${requestData.to}`,
        );

        // Create transaction
        const transaction = new this.transactionModel({
          _id: Utils.createObjectId(),
          nft: this.convertToSimpleNFT(nft),
          type: TransactionType.TRANSFER_OUTSIDE,
          tokenIds: [requestData.tokenId],
          fromAddress: requestData.from,
          toAddress: requestData.to,
          quantity: 1,
          status: TransactionStatus.SUCCESS,
          hash: requestData.hash,
        });
        await this.transferNFT({
          nft,
          transaction,
        });

        return transaction;
      },
    );
  }

  async getReceiverAddressesByType(type: NotificationType) {
    switch (type) {
      case NotificationType.P2:
      case NotificationType.P3:
        return await this.getUsersByPermission(AdminPermissions.NFT_MANAGEMENT);
      case NotificationType.P1:
      case NotificationType.P4:
      case NotificationType.P5:
      case NotificationType.P6:
        return await this.getUsersByPermission(
          AdminPermissions.EVENT_MANAGEMENT,
        );
      case NotificationType.P7:
      case NotificationType.P8:
      case NotificationType.P9:
      case NotificationType.P10:
      case NotificationType.P11:
      case NotificationType.P13:
        return await this.getUsersByPermission(
          AdminPermissions.LOCKING_MANAGEMENT,
        );
      case NotificationType.P12:
        return await this.getUsersByPermission(
          AdminPermissions.REDEMPTION_MANAGEMENT,
        );
    }
  }

  async getUsersByPermission(permission: AdminPermissions) {
    const users = await this.userModel.find({
      role: {
        $in: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
      },
      status: UserStatus.ACTIVE,
      isDeleted: false,
      permissions: permission,
    });
    const listAddress = users.map((user) => user.address);
    return listAddress;
  }

  calculateUsd(currency: Currency, unitPrice: any) {
    return Utils.toDecimal(
      new BigNumber(unitPrice).multipliedBy(currency.usd).toString(),
    );
  }

  convertToSimpleCurrency(currency: Currency) {
    const simpleCurrency: SimpleCurrency = {
      name: currency.name,
      displayName: currency.displayName,
      symbol: currency.symbol,
      chainId: currency.chainId,
      usd: undefined,
      imageUrl: currency.imageUrl,
      isNativeToken: currency.isNativeToken,
    };
    return simpleCurrency;
  }

  convertToSimpleToken(nft: NFTDocument) {
    const simpleToken: SimpleToken = {
      standard: nft.token.standard,
      totalSupply: nft.token.totalSupply,
      totalMinted: nft.token.totalMinted,
      cid: nft.token.cid,
    };
    return simpleToken;
  }

  convertToSimpleNFT(nft: NFTDocument) {
    const simpleNFT: SimpleNFT = {
      id: nft._id,
      name: nft.name,
      code: nft.code,
      slug: nft.slug,
      image: nft.image,
    };
    return simpleNFT;
  }

  async generateCaculateUsdStages(data: {
    currencyField: string;
    unitPriceField: string;
    usdField: string;
  }) {
    const currencies = await this.findCurrencies();
    return [
      {
        $addFields: {
          currencies: currencies,
        },
      },
      {
        $set: {
          [data.currencyField]: {
            $first: {
              $filter: {
                input: '$currencies',
                as: 'currency',
                cond: {
                  $eq: ['$$currency.name', `$${data.currencyField}.name`],
                },
              },
            },
          },
        },
      },
      {
        $set: {
          [data.usdField]: {
            $multiply: [
              `$${data.currencyField}.usd`,
              `$${data.unitPriceField}`,
            ],
          },
        },
      },
      {
        $unset: 'currencies',
      },
    ];
  }

  validateWhiteListWhenPurchase(
    whiteListAddress: string[],
    userAddress: string,
  ) {
    const index = whiteListAddress.findIndex((elementAddress) => {
      return elementAddress.toLowerCase() === userAddress.toLowerCase();
    });
    if (index === -1) {
      throw ApiError(
        ErrorCode.INVALID_DATA,
        'whilelist does not contain userAddress',
      );
    }
  }

  async getChildrenOrDirectRefereeFromAddress(
    address: string,
    isDirectReferee = false,
  ) {
    const andCondition: mongoose.FilterQuery<TransactionDocument>[] = [
      {
        pathId: {
          $elemMatch: { $regex: `^${address}$`, $options: 'i' },
        },
      },
      {
        isDeleted: false,
      },
    ];
    if (isDirectReferee) {
      andCondition.push({ referrer: { $regex: address, $options: 'i' } });
    }
    const pipeline = [
      {
        $match: {
          $and: andCondition,
        },
      },
      {
        $project: {
          _id: 1,
          address: 1,
          referrer: 1,
          originator: 1,
        },
      },
    ];
    return this.userModel.aggregate(pipeline);
  }

  async getGroupInfoByAddress(children: any[]) {
    const inCondition = children.map((item) => new RegExp(item.address, 'i'));
    return this.transactionModel.aggregate([
      {
        $match: {
          toAddress: { $in: inCondition },
          status: TransactionStatus.SUCCESS,
          type: TransactionType.MINTED,
        },
      },
      {
        $group: {
          _id: null,
          totalTokenSold: {
            $sum: '$quantity',
          },
          totalVolume: {
            $sum: '$revenue',
          },
        },
      },
      { $set: { totalMember: children.length } },
      { $unset: ['_id'] },
    ]);
  }

  async getTokensInfoDetailByTokenIds(tokenIds: string[]) {
    return await this.ownerModel.find({ tokenId: { $in: tokenIds } });
  }

  async getTokensInfoDetailByTokenId(tokenId: string) {
    const result = await this.ownerModel.findOne({ tokenId: tokenId });
    if (!result) {
      throw ApiError(ErrorCode.INVALID_DATA, 'Cannot found token!');
    }
    return result;
  }

  async getBDAOfUser(originator: string) {
    const isBda = await this.checkBda(originator);
    if (isBda) return originator;
    return;
  }

  async checkBda(address: string) {
    try {
      const user = await this.findUserByAddress(address);
      if (user.userType === UserType.BDA) return true;
      return false;
    } catch (error) {
      return false;
    }
  }

  async singleCandidateKyc(
    clientId: string,
    refId: string,
    apiKey: string,
  ): Promise<SingleCandidateDto> {
    const response: any = await axios({
      method: 'GET',
      url: `https://kyc.blockpass.org/kyc/1.0/connect/${clientId}/refId/${refId}`,
      headers: {
        Authorization: apiKey,
      },
    });
    if (response.status === 200) {
      return response.data.data;
    } else {
      throw new Error(response.statusText);
    }
  }

  sortArrayOfObject(values: any[], requestSort: any) {
    const { sort } = requestSort;
    if (!sort) return values;
    Object.keys(sort).forEach((field) => {
      values.sort((a, b) =>
        sort[field] === 'asc' ? a[field] - b[field] : b[field] - a[field],
      );
    });
  }

  async userWithRoleCompany() {
    const user = await this.userModel.findOne({ role: UserRole.SYSTEM });
    if (!user) {
      throw ApiError(ErrorCode.NO_DATA_EXISTS, 'User not found');
    }
    return user;
  }

  async canLoseBDAPermission(
    user: UserDocument,
    actionType: ActionType,
    transaction: TransactionDocument,
  ) {
    const result = { status: false, message: '' };
    const [quantityOftoken, blackNFTAfterTrasferring, blackNFTAfterRedemption] =
      await Promise.all([
        this.countingOwnedTokenByUser(user),
        this.countNftBlacks(user.address, true),
        this.countNftBlacksAfterRedemption(user.address),
      ]);
    if (user.haveReceivedBlackFromAdmin) {
      switch (actionType) {
        case ActionType.REDEMPTION:
          if (user.userType === UserType.BDA && blackNFTAfterRedemption === 0) {
            return {
              status: true,
              message: NotificationType.N5,
            };
          }
          return result;
        case ActionType.TRANSFER_NFT:
          if (
            user.userType === UserType.BDA &&
            blackNFTAfterTrasferring === 1 &&
            quantityOftoken === 1
          ) {
            return {
              status: true,
              message: NotificationType.N5,
            };
          }
          return result;
        case ActionType.TRANSFER_BLACK_NFT:
          if (
            user.userType === UserType.BDA &&
            blackNFTAfterTrasferring === 1
          ) {
            return {
              status: true,
              message: NotificationType.N5,
            };
          }
          return result;
      }
    } else {
      switch (actionType) {
        case ActionType.TRANSFER_BLACK_NFT:
        case ActionType.TRANSFER_NFT:
          if (user.userType === UserType.BDA && quantityOftoken === 1) {
            return {
              status: true,
              message: NotificationType.N6,
            };
          }
          return result;
      }
    }
  }

  async updateTransporter(data: {
    fromAddress: string;
    actionType: ActionType;
    transaction: TransactionDocument;
    session: any;
  }) {
    const { fromAddress, session, actionType, transaction } = data;
    try {
      const transporter = await this.findUserByAddress(fromAddress);
      const { status, message } = await this.canLoseBDAPermission(
        transporter,
        actionType,
        transaction,
      );
      if (message) {
        // await this.pushNotificationUser(
        //   message,
        //   { toAddress: transporter.address },
        //   session,
        // );
      }
      if (status) {
        return this.updateUserInfoAfterLosingBDA({ transporter, session });
      }
    } catch (error) {
      return;
    }
  }

  async updateUserInfoAfterLosingBDA(data: {
    transporter: UserDocument;
    session: any;
  }) {
    const { transporter, session } = data;
    return Promise.all([
      this.userModel.findOneAndUpdate(
        // update BDA --> COMMOM
        {
          address: Utils.formatAddress(transporter.address),
          isDeleted: false,
          role: UserRole.USER,
        },
        {
          userType: UserType.COMMON,
          personalVolume: 0,
          equityShares: 0,
        },
        {
          session,
          new: true,
        },
      ),
      this.userModel.updateMany(
        // update orinator -> transporter.originator
        {
          originator: Utils.formatAddress(transporter.address),
          isDeleted: false,
          role: UserRole.USER,
        },
        {
          originator: transporter.originator,
        },
        {
          session,
          new: true,
        },
      ),
    ]);
  }

  async updateReceiverNFT(data: {
    transaction: TransactionDocument;
    nft: NFTDocument;
    session: any;
  }) {
    const { nft, session, transaction } = data;
    const { toAddress } = transaction;
    const promises = [];
    let receiver;
    try {
      receiver = await this.findUserByAddress(toAddress);
    } catch (error) {
      return null;
    }

    return Promise.all(promises);
  }

  updateOwnerTransferNft(
    tokenId: string,
    toAddress: string,
    session: any,
    nftId: any,
  ) {
    return this.ownerModel.findOneAndUpdate(
      {
        nftId: nftId,
        tokenId: tokenId,
      },
      {
        address: Utils.formatAddress(toAddress),
        isTransfer: true,
      },
      {
        session,
        new: true,
      },
    );
  }

  async updateAdminAction(
    transaction: TransactionDocument,
    requestData: UpdateTransactionDto,
  ) {
    return this.withLock(
      {
        type: LockType.ADMIN_SETTING,
        documentId: transaction._id,
      },
      async () => {
        // Check transaction success
        const alreadyCompleted = this.checkTransactionAlreadyCompleted(
          transaction,
          requestData.isFromWorker,
        );
        if (alreadyCompleted.isAlreadyCompleted) {
          return alreadyCompleted;
        }
        const session = await this.connection.startSession();
        await session.withTransaction(async () => {
          const promises = [];
          // Update Transaction: status
          transaction.status = TransactionStatus.SUCCESS;
          transaction.hash = requestData.hash;

          promises.push(transaction.save({ session }));

          await this.updateUserAfterTransactionSucceed(
            promises,
            transaction,
            session,
          );

          const results = await Promise.all(promises);
          this.logPromise(promises, results);
        });
        await session.endSession();
        return transaction;
      },
    );
  }

  async updateUserAfterTransactionSucceed(
    promises,
    transaction: TransactionDocument,
    session,
  ) {
    switch (transaction.type) {
      case TransactionType.ADMIN_SETTING:
        const admin = await this.userModel.findOne({
          address: transaction.toAddress,
        });
        if (admin) {
          promises.push(
            this.userModel.findOneAndUpdate(
              {
                type: UserRole.ADMIN,
                address: transaction.toAddress,
                isDeleted: false,
                status: UserStatus.DRAFT,
              },
              {
                status: UserStatus.ACTIVE,
              },
              {
                session,
                new: true,
              },
            ),
          );
        } else {
          promises.push(
            this.userModel.create(
              [
                {
                  type: UserRole.ADMIN,
                  address: transaction.toAddress,

                  status: UserStatus.ACTIVE,
                },
              ],
              {
                session,
                new: true,
              },
            ),
          );
        }
        break;

      case TransactionType.ADMIN_DELETE:
        promises.push(
          this.userModel.findOneAndDelete(
            {
              type: UserRole.ADMIN,
              address: transaction.toAddress,
            },
            {
              session,
              new: true,
            },
          ),
        );
        break;
    }
    return promises;
  }

  async getPermissionsOfAdmin(address: string) {
    const admin = await this.userModel.findOne(
      {
        address: Utils.formatAddress(address),
        // isDeleted: false,
        status: UserStatus.ACTIVE,
        role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
      },
      {
        permissions: 1,
      },
    );
    if (!admin) throw new ForbiddenException();
    return admin.permissions;
  }

  async countNftBlacks(address: string, flag: boolean) {
    const condition = {
      isMintedAddressAdmin: true,
      address: Utils.formatAddress(address),
      status: { $nin: [OwnerStatus.BURNED, OwnerStatus.INVALID] },
    };
    if (!flag) condition['isTransfer'] = false;
    return this.ownerModel.find(condition).countDocuments();
  }

  async countNftBlacksAfterRedemption(address: string) {
    const condition = {
      isMintedAddressAdmin: true,
      address: Utils.formatAddress(address),
      status: { $in: [OwnerStatus.LOCKED, OwnerStatus.UNLOCKED] },
    };
    return this.ownerModel.find(condition).countDocuments();
  }

  async updateAdminAfterTransactionFail(
    transaction: TransactionDocument,
    promises: any[],
    session: any,
  ) {
    switch (transaction.type) {
      case TransactionType.ADMIN_SETTING:
        return promises.push(
          this.userModel.findOneAndDelete(
            {
              type: UserRole.ADMIN,
              address: transaction.toAddress,
              isDeleted: false,
              status: UserStatus.DRAFT,
            },
            {
              session,
              new: true,
            },
          ),
        );

        return this.userModel.findOneAndUpdate(
          {
            type: UserRole.ADMIN,
            address: transaction.toAddress,
            isDeleted: true,
          },
          {
            isDeleted: false,
          },
          {
            session,
            new: true,
          },
        );
    }
  }

  async updateStatusAdminAction(address: string) {
    const admin = await this.userModel.findOne({
      address: Utils.formatAddress(address),
      status: UserStatus.ACTIVE,
      // isHavingAction: false,
      role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
    });
    if (!admin) throw new ForbiddenException();
    if (!admin.isHavingAction) {
      admin.isHavingAction = true;
      return admin.save();
    }
    return;
  }

  async createAdmin(data, session: any) {
    return this.userModel.create([data], { session });
  }

  async countLockingSharesByUser(address: string) {
    try {
      const result = await this.ownerModel.aggregate([
        {
          $match: {
            status: OwnerStatus.LOCKED,
            address,
          },
        },
      ]);
      return result?.length > 0 ? result[0].totalLocking : 0;
    } catch (error) {
      return 0;
    }
  }

  async isAllTokensInvalid(tokenIds: any[]) {
    const result = await this.ownerModel.aggregate([
      {
        $match: {
          tokenId: { $in: tokenIds },
          status: OwnerStatus.INVALID,
        },
      },
    ]);
    return result?.length === tokenIds?.length;
  }

  async updateOwnerAfterCreateNft(data) {
    console.log('data :>> ', data);
    const { nft, address } = data;
    const owner = {
      address,
      tokenId: nft._id,
      mintedDate: new Date(),
      status: OwnerStatus.UNMINT,
      nftId: nft._id,
      nft: this.convertToSimpleNFT(nft),
      isTransfer: false,
    };
    return this.ownerModel.insertMany(owner);
  }

  async updateOwnerAfterMint(data) {
    const { nftId, address, totalSupply, hash } = data;
    return this.ownerModel.updateOne(
      {
        nftId: nftId,
      },
      {
        $set: {
          mintedAddress: address,
          mintedHash: hash,
          mintedDate: new Date(),
          status: OwnerStatus.MINTED,
          amount: totalSupply,
          tokenId: nftId,
        },
      },
    );
  }

  async updateOwnerAfterBuy(data) {
    const { nft, address } = data;
    return this.ownerModel.updateOne(
      {
        tokenId: nft._id,
      },
      {
        $set: {
          address: address,
          status: OwnerStatus.MINTED,
        },
      },
    );
  }

  async findOwned(user: UserJWT, id: string, requestData) {
    const match: any = {
      $and: [
        { isDeleted: false },
        {
          'owners.address': user.address,
        },
      ],
    };

    if (requestData.keyword) {
      match.$or = [
        {
          'owners.event.name': {
            $regex: requestData.keyword,
            $options: 'i',
          },
        },
        {
          'owners.tokenId': requestData.keyword,
        },
      ];
    }

    if (requestData?.fromMintDate) {
      match.$and.push({
        'owners.mintedDate': { $gte: new Date(requestData.fromMintDate) },
      });
    }

    if (requestData?.toMintDate) {
      match.$and.push({
        'owners.mintedDate': { $lte: new Date(requestData.toMintDate) },
      });
    }

    const pipe: mongoose.PipelineStage[] = [
      {
        $match: match,
      },
      {
        $lookup: {
          from: 'nfts',
          localField: 'nftId',
          foreignField: '_id',
          as: 'nfts',
        },
      },
      {
        $unwind: '$nfts',
      },
    ];

    const result = await Utils.aggregatePaginate(
      this.ownerModel,
      pipe,
      requestData,
    );
    return result;
  }

  getProvider(networkId: string) {
    if (networkId === process.env.CHAIN_ID) {
      return ethers.getDefaultProvider(process.env.CHAIN_RPC_URL);
    }
  }
}

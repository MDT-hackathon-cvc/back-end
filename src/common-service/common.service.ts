
import { OwnerStatus } from './../schemas/NFT.schema';
import {
  CACHE_MANAGER,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Model, Mongoose } from 'mongoose';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ApiError } from 'src/common/api';
import {
  CacheKeyName,
  CONFIG_TO_BECOME_BDA,
  Contract,
  DEFAULT_BDA,
  DEFAULT_BDA_RATIO,
  DEFAULT_COMMISSION_RATIO,
  DEFAULT_DIVISOR,
  DEFAULT_REFERRER,
  ErrorCode,
  FORTY_PERCENT,
  MIMEType,
  QUEUE,
  QUEUE_SETTINGS,
  ROLE_NOTI,
  VALUE_A_SHARE,
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
  AdminTemp,
  Transaction,
  TransactionDocument,
  TransactionSignature,
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
import { Web3Gateway } from 'src/blockchain/web3.gateway';
import mongoose from 'mongoose';
import { Lock, LockDocument, LockType } from 'src/schemas/Lock.schema';
import { Cache, CachingConfig } from 'cache-manager';
import { UpdateTransactionDto } from 'src/transactions/dto/user/update-transaction.dto';
import BigNumber from 'bignumber.js';
import { SocketGateway } from 'src/providers/socket/socket.gateway';
import {
  Content,
  Notification,
  NotificationAddress,
  NotificationDocument,
  NotificationType,
} from 'src/schemas/Notification.schema';
import { SOCKET_EVENT, SOCKET_ROOM } from 'src/providers/socket/socket.enum';
import {
  AdminActions,
  AdminPermissions,
  KYCInfo,
  KYCStatus,
  User,
  UserDocument,
  UserRole,
  UserStatus,
  UserType,
} from 'src/schemas/User.schema';
import { Web3PastEvent, Web3Token } from 'src/blockchain/web3.type';
import { AwsUtils } from 'src/common/aws.util';
import { TransferDto } from 'src/providers/worker/dto/transfer.dto';
import * as Queue from 'bee-queue';
import { IpfsGateway } from 'src/providers/ipfs/ipfs.gateway';
import * as moment from 'moment';
import {
  TransactionTransfer,
  TransactionTransferDocument,
  TransactionTransferStatus,
} from 'src/schemas/TransactionTransfer.schema';
import {
  TransactionTransferSync,
  TransactionTransferSyncDocument,
} from 'src/schemas/TransactionTransferSync.schema';
import {
  CategoryInEvent,
  Event,
  EventDocument,
  EventStatus,
  EventType,
  SimpleEvent,
} from 'src/schemas/Event.schema';
import { Web3ETH } from 'src/blockchain/web3.eth';
import ObjectID from 'bson-objectid';
import axios from 'axios';
import { SingleCandidateDto } from 'src/users/dto/kyc-user.dto';
import { OwnerDocument } from 'src/schemas/Owner.schema';
import {
  LockHistory,
  LockHistoryDocument,
} from 'src/schemas/LockHistory.schema';
import { PushNotificationDto } from 'src/notifications/dto/push-notification.dto';

const countries = require('../resource/country-key-value.json');

export enum ActionType {
  REDEMPTION = 1,
  TRANSFER_NFT = 2,
  TRANSFER_BLACK_NFT = 3,
}
@Injectable()
export class CommonService implements OnModuleInit {
  private readonly logger = new Logger(CommonService.name);
  private readonly ipfsQueue = new Queue(QUEUE.UPLOAD_IPFS, QUEUE_SETTINGS);
  private readonly transactionProcessingQueue = new Queue(
    QUEUE.TRANSACTION_PROCESSING,
    QUEUE_SETTINGS,
  );

  private readonly kycQueue = new Queue(QUEUE.KYC, QUEUE_SETTINGS);

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

    @InjectModel(Event.name)
    private eventModel: Model<EventDocument>,

    @InjectModel(LockHistory.name)
    private lockHistoryModel: Model<LockHistoryDocument>,

    @InjectModel(Owner.name)
    private ownerModel: Model<OwnerDocument>,

  ) {}

  async onModuleInit() {
    await this.initIpfsQueue();
    await this.initTransactionProcessingQueue();
    await this.initKycQueue();
  }

  async initIpfsQueue() {
    this.ipfsQueue.process(async (job) => {
      try {
        const ipfsGateway = new IpfsGateway();
        const nftId = job.data;
        const nft = await this.nftModel.findById(nftId);
        if (nft?.isDeleted) {
          return;
        }

        this.logger.log(`initIpfsQueue(): Uploading IPFS for NFT ID ${nft.id}`);
        const updateCid = {};
        if (!nft.token.cid) {
          this.logger.debug(`nft.image.url`, nft.image.url);
          const cid = await ipfsGateway.uploadFromURL(
            nft.image.url,
            nft.image.mimeType,
          );
          updateCid['token.cid'] = cid;
        }
        if (nft.media && nft.media.url && !nft.token.cidMedia) {
          this.logger.debug(`nft.media.url`, nft.media.url);
          const cid = await ipfsGateway.uploadFromURL(
            nft.media.url,
            nft.media.mimeType,
          );
          updateCid['token.cidMedia'] = cid;
        }
        await nft.updateOne({
          $set: {
            ...updateCid,
          },
        });
        return updateCid;
      } catch (error) {
        return Promise.reject(error);
      }
    });
    this.ipfsQueue.on('succeeded', (job, result) => {
      // prettier-ignore
      this.logger.log(`initIpfsQueue(): Upload IPFS for NFT ID ${job.id} succeeded. Cid = ${JSON.stringify(result)}`);
    });
    this.ipfsQueue.on('failed', (job, err) => {
      this.logger.error(
        `initIpfsQueue(): Upload IPFS for NFT ID ${job.id} failed: ${err.message}`,
      );
      this.logError(err);
    });

    // Init data when restart server
    const nfts = await this.nftModel.find({
      $and: [
        {
          isDeleted: false,
        },
        {
          $or: [{ 'token.cid': { $exists: false } }, { 'token.cid': '' }],
        },
      ],
    });
    for (let index = 0; index < nfts.length; index++) {
      const nft = nfts[index];
      const currentJob = await this.ipfsQueue.getJob(nft._id.toString());
      if (currentJob) {
        await currentJob.remove();
      }
      this.logger.log(
        `initIpfsQueue(): Add Job Upload IPFS for NFT ID ${nft._id.toString()}`,
      );
      await this.addQueueUploadIpfs(nft._id.toString());
    }
  }

  async initTransactionProcessingQueue() {
    this.transactionProcessingQueue.process(async (job) => {
      try {
        const transactionId = job.data;
        const transaction = await this.transactionModel.findById(transactionId);
        this.logger.log(
          `Checking transaction ${transaction.id}, hash = ${transaction.hash}`,
        );
        if (transaction.status !== TransactionStatus.PROCESSING) {
          this.logger.debug(
            `Transaction ${transaction.hash} is not in processing status. Current status = ${transaction.status}`,
          );
          return;
        }

        const session = await this.connection.startSession();
        await session.withTransaction(async () => {
          const web3Gateway = new Web3Gateway();
          const transactionReceipt = await web3Gateway.getTransactionReceipt(
            transaction.hash,
          );
          if (!transactionReceipt) {
            return Promise.reject(
              new Error(
                `Can't get transaction receipt for hash ${transaction.hash}`,
              ),
            );
          }
          if (!transactionReceipt.status) {
            const promisesUpdate = [];
            transaction.status = TransactionStatus.FAILED;
            promisesUpdate.push(transaction.save({ session }));
            const results = await Promise.all(promisesUpdate);
            this.logPromise(promisesUpdate, results);
          } else {
            this.logger.debug(
              `Transaction ${transaction.hash} has been successful`,
            );
          }
        });
        session.endSession();
      } catch (error) {
        return Promise.reject(error);
      }
    });
    this.transactionProcessingQueue.on('succeeded', (job, result) => {
      // prettier-ignore
      this.logger.log(`Check transaction ${job.id} succeeded.`);
    });
    this.transactionProcessingQueue.on('failed', async (job, err) => {
      this.logger.error(`Check transaction ${job.id} failed: ${err.message}`);
      const trans = await this.transactionModel.findById(job.id);
      if (!trans) {
        await job.remove();
      }

      this.logError(err);
    });

    // Init data when restart server
    const transactions = await this.transactionModel.find({
      type: TransactionType.TRANSFER,
      status: TransactionStatus.PROCESSING,
    });
    for (let index = 0; index < transactions.length; index++) {
      const transaction = transactions[index];
      const currentJob = await this.transactionProcessingQueue.getJob(
        transaction.id,
      );
      if (currentJob) {
        await currentJob.remove();
      }
      await this.addQueueCheckTransaction(transaction);
    }
  }

  async clearQueueUploadIpfs(id: string) {
    this.logger.log(`clearQueueUploadIpfs(): Clear Queue Upload IPFS ${id}`);
    const currentJob = await this.ipfsQueue.getJob(id);
    if (currentJob) {
      await currentJob.remove();
    }
  }

  async addQueueUploadIpfs(id: string) {
    this.logger.log(
      `addQueueUploadIpfs(): Add Queue Upload IPFS for NFT ${id}`,
    );
    const currentJob = await this.ipfsQueue.getJob(id);
    if (currentJob) {
      return;
    }
    const job = this.ipfsQueue
      .createJob(id)
      .setId(id)
      .retries(100000000000000000000)
      .backoff('fixed', 5000)
      .delayUntil(moment().add(30, 'second').toDate());
    await job.save();
  }

  async clearQueueCheckTransaction(id: string) {
    this.logger.log(`Clear Queue Check Transaction ${id}`);
    const currentJob = await this.transactionProcessingQueue.getJob(id);
    if (currentJob) {
      await currentJob.remove();
    }
  }

  async addQueueCheckTransaction(transaction: TransactionDocument) {
    if (!Utils.isValidateHash(transaction.hash)) {
      this.logger.error(`Transaction ${transaction.hash} is not valid`);
      return;
    }
    this.logger.log(`Add Queue Check Transaction ${transaction.hash}`);
    const currentJob = await this.transactionProcessingQueue.getJob(
      transaction.id,
    );
    if (currentJob) {
      return;
    }
    const job = this.transactionProcessingQueue
      .createJob(transaction.id)
      .setId(transaction.id)
      .delayUntil(moment().add(2, 'm').toDate())
      .retries(100000000000000000000)
      .backoff('fixed', 5000);
    await job.save();
  }

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

  async findPercentRedemptionValue() {
    const config = await this.findFullConfig();
    const percentRedemptionValue = config.percentRedemptionValue || 1.5;
    return percentRedemptionValue;
  }

  async findSigner() {
    const config = await this.findFullConfig();
    const privateKey = await Utils.decrypt(config.signer.privateKey);
    return {
      address: config.signer.address,
      privateKey,
    };
  }

  async findBDARatio() {
    const config = await this.findFullConfig();
    const percentBDARation = config.percentBDARatio || 200;
    return percentBDARation;
  }

  async findCommissionRatio() {
    const config = await this.findFullConfig();
    const percentCommissionRatio = config.percentCommissionRatio || 800;
    return percentCommissionRatio;
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

  cancelEvent(
    transaction: TransactionDocument,
    requestData: UpdateTransactionDto,
  ) {
    return this.withLock(
      {
        type: LockType.CANCEL_EVENT,
        documentId: transaction._id,
      },
      async () => {
        const event = await this.findEventById(transaction.event.id);
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
          transaction.message = requestData?.message || '';
          if (requestData.isFromWorker) {
            transaction.syncedAt = new Date();
          }
          promises.push(transaction.save({ session }));
          // update event
          event.status = EventStatus.CANCEL;
          event.hashCancel = requestData.hash;
          promises.push(event.save({ session }));
          // update nft info
          for (const category of event.categories) {
            const nft = await this.findNFTById(category.nftId);
            promises.push(
              this.nftModel.updateOne(
                {
                  _id: category.nftId,
                },
                {
                  $inc: {
                    'token.totalAvailable':
                      category.quantityForSale - category.totalMinted,
                  },
                  $set: {
                    status: this.nftStatusAfterCancelingEvent(category, nft),
                  },
                },
                { session },
              ),
            );
          }
          const results = await Promise.all(promises);
          this.logPromise(promises, results);
        });
        session.endSession();
      },
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
          transaction.message = requestData?.message || '';
          if (requestData.isFromWorker) {
            transaction.syncedAt = new Date();
          }
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

  async updateTransactionBuyNFT(data: {
    requestData: UpdateTransactionDto;
    transaction: TransactionDocument;
    tokenIds: string[];
    session: any;
  }) {
    const { requestData, transaction, tokenIds, session } = data;

    transaction.status = TransactionStatus.SUCCESS;
    transaction.hash = requestData.hash;
    transaction.message = requestData.message;
    const newEvent = {
      ...transaction.event,
      category: { ...transaction.event.category },
    };
    newEvent.category.totalMinted += tokenIds.length;
    transaction.event = newEvent;
    if (tokenIds && tokenIds.length > 0) {
      transaction.tokenIds = tokenIds;
    }
    if (requestData.isFromWorker) {
      transaction.syncedAt = new Date();
    }
    return transaction.save({ session });
  }

  async updateNFT(data: {
    transaction: TransactionDocument;
    nft: NFTDocument;
    event?: EventDocument;
    session: any;
  }) {
    const { transaction, nft, event, session } = data;
    const updateNFT: any = {};
    const totalNftRemain = nft.token.totalSupply - nft.token.totalMinted;
    if (transaction.type == TransactionType.MINTED) {
      if (totalNftRemain - transaction.quantity <= 0) {
        this.logger.debug(
          `updateNFT(): NFT ${nft._id} sold out. TotalSuppy = ${nft.token.totalSupply}. TotalMinted = ${nft.token.totalMinted}`,
        );
        updateNFT.status = NFTStatus.SOLD_OUT;
      }
      if (totalNftRemain - transaction.quantity > 0) {
        this.logger.debug(
          `updateNFT(): NFT ${nft._id} off-sale. TotalSuppy = ${nft.token.totalSupply}. TotalMinted = ${nft.token.totalMinted}`,
        );
        const checkNftOffSale = await this.checkOffSaleNft(
          nft.id,
          event,
          transaction.quantity,
        );
        if (checkNftOffSale) updateNFT.status = NFTStatus.OFF_SALE;
      }
    }

    // MINTED
    // prettier-ignore
    if (
      transaction.type === TransactionType.MINTED ||
      transaction.type === TransactionType.ADMIN_MINTED ||
      transaction.fromAddress === Contract.ZERO_ADDRESS
    ) {
      this.logger.log(
        `updateNFT(): Minted ${transaction.quantity} NFT ${nft._id} TokenID ${transaction.tokenIds}`,
      );
      // Update token id and owners
      const listOwners = []
      for (const itemTokenId of transaction.tokenIds) {
        const owner = {
          tokenId: itemTokenId,
          mintedAddress: transaction.type === TransactionType.ADMIN_MINTED ? transaction.adminMintedAddress : transaction.toAddress,
          isMintedAddressAdmin: transaction.type === TransactionType.ADMIN_MINTED ? true : false,
          address: transaction.toAddress,
          isAddressAdmin: false,
          event: {
            id: event?._id,
            imgUrl: event?.imgUrl,
            name: event?.name
          },
          mintedDate: new Date(),
          mintedHash: transaction.hash,
          mintedValue: transaction.event ? Utils.toDecimal(transaction.event?.category?.unitPrice) : 0,
          status: OwnerStatus.UNLOCKED,
          rewardEvents: 0,
          nftId: nft._id,
          nft: this.convertToSimpleNFT(nft),
          isTransfer: false
        }
        listOwners.push(owner)
      }

      const updateTokenIdToNft = {
        "token.ids": {
          $each: transaction.tokenIds
        },
      };
      const result = await Promise.all([
        this.ownerModel.insertMany(listOwners, { session: session }),
        this.nftModel.findOneAndUpdate(
          {
            _id: nft._id
          },
          {
            $inc: {
              'token.totalMinted': transaction.quantity,
            },
            $set: {
              ...updateNFT,
            },
            $push: {
              ...updateTokenIdToNft
            }
          },
          {
            session,
            new: true,
          },
        )
      ])
      // push noti
      if(updateNFT.status === NFTStatus.SOLD_OUT){
        await this.pushNotificationAdmin(NotificationType.P2,{nft: transaction.nft});
      }
      return result
    }

    // BURN
    if (transaction.toAddress === Contract.ZERO_ADDRESS) {
      this.logger.log(
        `updateNFT(): Burn ${transaction.quantity} NFT ${nft._id} TokenID ${transaction.tokenIds}`,
      );
      const tokenId = transaction.tokenIds[0];

      return this.nftModel.findOneAndUpdate(
        {
          _id: nft._id,
        },
        {
          $set: {
            ...updateNFT,
          },
          $inc: {
            'token.totalSupply': -transaction.quantity,
            'token.totalMinted': -transaction.quantity,
            'token.totalBurnt': transaction.quantity,
          },
          $pull: {
            'token.ids': tokenId,
          },
        },
        {
          session,
          new: true,
        },
      );
    }

    if (transaction.type === TransactionType.TRANSFER_OUTSIDE) {
      const tokenId = transaction.tokenIds[0];
      return this.updateOwnerTransferNft(
        tokenId,
        transaction.toAddress,
        session,
        nft._id,
      );
    }
  }

  checkTransactionAlreadyCompleted(
    transaction: TransactionDocument,
    isFromWorker = false,
  ) {
    if (transaction.status === TransactionStatus.SUCCESS) {
      this.logger.log(
        `checkTransactionAlreadyCompleted(): ${transaction.id} is already completed`,
      );
      if (isFromWorker) {
        transaction.syncedAt = new Date();
        transaction.save();
      }
      return {
        isAlreadyCompleted: true,
      };
    }
    return {
      isAlreadyCompleted: false,
    };
  }

  async buyNFT(
    transactionId: string,
    requestData: UpdateTransactionDto,
    tokenIds: string[],
  ) {
    return this.withLock(
      { type: LockType.BUY_NFT, documentId: transactionId },
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

        // Get NFT, Collection, User information
        const [nft, event] = await Promise.all([
          this.nftModel.findById(transaction.nft.id),
          this.eventModel.findById(transaction.event.id),
        ]);

        // check commission fee

        const session = await this.connection.startSession();
        await session.withTransaction(async () => {
          // Update Transaction: status, revenue
          await this.updateTransactionBuyNFT({
            requestData,
            transaction,
            tokenIds,
            session,
          });

          await this.updateEventBuyNft({
            transaction,
            nft,
            event,
            session,
          });

          await this.updateNFT({
            transaction,
            nft,
            event,
            session,
          });

          await this.updateUserAfterBuyingNft({
            transaction,
            nft,
            event,
            session,
          });
        });
        await session.endSession();
        // Push notification
        await this.pushNotificationAdmin(NotificationType.P1, {
          transaction,
        });

        const { bda, referrerDirect } = transaction.affiliateInfor;
        if (bda?.address === referrerDirect?.address) {
          // BDA & Direct Referrer
          await this.pushNotificationUser(NotificationType.N15, {
            toAddress: bda.address,
            userAddress: transaction.toAddress,
            transaction,
            role: ROLE_NOTI.BDA_DIRECT_REFERRE,
            commissionFee: new BigNumber(bda?.commissionFee.toString()).plus(
              referrerDirect.commissionFee.toString(),
            ),
          });
        } else {
          await Promise.all([
            this.pushNotificationUser(NotificationType.N15, {
              // BDA
              toAddress: bda.address,
              userAddress: transaction.toAddress,
              transaction,
              role: ROLE_NOTI.BDA,
              commissionFee: bda?.commissionFee,
            }),
            this.pushNotificationUser(NotificationType.N15, {
              // Direct Referrer
              toAddress: referrerDirect.address,
              userAddress: transaction.toAddress,
              transaction,
              role: ROLE_NOTI.DIRECT_REFERRE,
              commissionFee: referrerDirect?.commissionFee,
            }),
          ]);
        }

        return transaction;
      },
    );
  }

  async updateUserAfterBuyingNft(data: {
    transaction: TransactionDocument;
    nft: NFTDocument;
    event?: EventDocument;
    session: any;
  }) {
    const { transaction, session } = data;
    let personalVolumeReferrer = new BigNumber(0);
    const promise = [];
    // update personal volume
    const userInfo = await this.findUserByAddress(transaction.toAddress);

    // update volume of user
    userInfo.volume = new BigNumber(transaction?.revenue.toString())
      .plus(userInfo?.volume.toString() || 0)
      .toString() as any;

    // check user to become BDA and update children after user become BDA
    if (
      userInfo.userType === UserType.COMMON &&
      ((!userInfo.haveReceivedBlackFromAdmin &&
        new BigNumber(userInfo.oldPersonalVolume.toString()).gte(
          CONFIG_TO_BECOME_BDA,
        )) ||
        new BigNumber(userInfo.personalVolume.toString()).gte(
          CONFIG_TO_BECOME_BDA,
        ))
    ) {
      const childrenUser = this.updateUserBecomeBDA(userInfo, session);
      userInfo.userType = UserType.BDA;
      if (
        new BigNumber(userInfo.personalVolume.toString()).gte(
          CONFIG_TO_BECOME_BDA,
        )
      ) {
        userInfo.haveReceivedBlackFromAdmin = false;
        // ADD NOTIFICATION ADMIN
        promise.push(
          this.pushNotificationUser(
            NotificationType.N3,
            {
              toAddress: userInfo.address,
            },
            session,
          ),
          this.pushNotificationAdmin(
            NotificationType.P3,
            {
              toAddress: userInfo.address,
            },
            session,
          ),
        );
      }

      promise.push(...childrenUser);
    }

    promise.push(userInfo.save({ session }));

    // check user who has referrer, bda or not
    if (!userInfo?.referrer || !userInfo?.originator) {
      return promise;
    }

    // get referrer user model
    const referrerInfo = await this.findUserByAddress(userInfo.referrer);

    // get originator user model
    const originatorInfo = await this.findUserByAddress(userInfo.originator);
    // update personal volume
    personalVolumeReferrer = new BigNumber(
      transaction?.revenue.toString(),
    ).plus(referrerInfo.personalVolume.toString());
    referrerInfo.personalVolume = personalVolumeReferrer.toString() as any;
    const oldPersonalVolumeReferrer = new BigNumber(
      transaction?.revenue.toString(),
    ).plus(referrerInfo.oldPersonalVolume.toString());
    referrerInfo.oldPersonalVolume =
      oldPersonalVolumeReferrer.toString() as any;
    // update personal token sold
    referrerInfo.personalTokenSold += transaction.quantity;

    // update commission of referrer , bda
    if (transaction.affiliateInfor.bda.address === originatorInfo.address) {
      originatorInfo.commission = new BigNumber(
        transaction.affiliateInfor.bda.commissionFee.toString(),
      )
        .plus(originatorInfo.commission.toString())
        .toString() as any;
    }

    if (
      transaction.affiliateInfor.referrerDirect.address === referrerInfo.address
    ) {
      referrerInfo.commission = new BigNumber(
        transaction.affiliateInfor.referrerDirect.commissionFee.toString(),
      )
        .plus(referrerInfo.commission.toString())
        .toString() as any;
    }

    // check referrer of user to become BDA and update children after user become BDA
    const { status, message } = await this.canBecomeBDA(referrerInfo);

    if (message) {
      // promise.push(
      //   this.pushNotificationUser(
      //     message,
      //     { toAddress: referrerInfo.address },
      //     session,
      //   ),
      // );
      // ADD NOTIFICATION ADMIN
    }

    if (
      referrerInfo.userType === UserType.COMMON &&
      new BigNumber(referrerInfo.personalVolume.toString()).gte(
        CONFIG_TO_BECOME_BDA,
      )
    ) {
      referrerInfo.haveReceivedBlackFromAdmin = false;
    }
    // Noti BDA
    if (status) {
      const childrenReferrer = this.updateUserBecomeBDA(referrerInfo, session);
      referrerInfo.userType = UserType.BDA;
      referrerInfo.haveReceivedBlackFromAdmin = false;
      promise.push(...childrenReferrer);
      promise.push(
        this.pushNotificationUser(
          NotificationType.N3,
          { toAddress: referrerInfo.address },
          session,
        ),
        this.pushNotificationAdmin(
          NotificationType.P3,
          {
            toAddress: referrerInfo.address,
          },
          session,
        ),
      );
    }

    const result = await Promise.all(promise);
    return result;
  }

  async canBecomeBDA(user: UserDocument) {
    const result = { status: false, message: '' };
    const quantityOfToken = await this.countingOwnedTokenByUser(user);
    if (quantityOfToken === 0) {
      result.message = new BigNumber(user.personalVolume.toString()).gte(
        CONFIG_TO_BECOME_BDA,
      )
        ? NotificationType.N7
        : '';
      return result;
    }
    result.status =
      user.userType === UserType.COMMON &&
      new BigNumber(user.personalVolume.toString()).gte(CONFIG_TO_BECOME_BDA);
    return result;
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
          transaction.message = requestData.message;
          transaction.tokenIds = tokenIds;
          if (requestData.isFromWorker) {
            transaction.syncedAt = new Date();
          }
          promises.push(transaction.save({ session }));

          const nft = await this.nftModel.findById(transaction.nft.id);

          // Update NFT: status, token id, total supply, total minted
          await this.updateNFT({
            transaction,
            nft,
            session,
          });
          // update user info when admin mints Black NFT to one
          if (nft.isNFTBlack) {
            await this.userModel.findOneAndUpdate(
              { address: transaction.toAddress },
              {
                haveReceivedBlackFromAdmin: true,
              },
              {
                session: session,
                new: true,
              },
            );
          }
        });
        await session.endSession();
        // push noti
        await this.pushNotificationUser(NotificationType.N12, {
          toAddress: transaction.toAddress,
        });
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
        switch (nft.isNFTBlack) {
          case true:
            await this.updateTransferBlackDiamond({
              transaction,
              nft,
              session,
            });
            break;
          case false:
            await this.updateNFT({
              transaction,
              nft,
              session,
            });
            await this.updateTransporter({
              fromAddress,
              actionType: ActionType.TRANSFER_NFT,
              transaction,
              session,
            });
            await this.updateReceiverNFT({ transaction, nft, session });
            break;
        }
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

  async pushNotificationUser(
    type: NotificationType,
    data: PushNotificationDto,
    session?: any,
  ) {
    try {
      const {
        toAddress,
        userAddress,
        referralAddress,
        mintingEvent,
        transaction,
        role,
        commissionFee,
        recoverTokenId,
      } = data;
      this.logger.log(`pushNotificationUser(): Push notification ${type}`);

      const createNotification = new this.notificationModel({
        addressRead: [],
        address: toAddress,
      });

      let socketToRoom: any = toAddress;
      let content;
      switch (type) {
        case NotificationType.N1:
        case NotificationType.N2:
        case NotificationType.N3:
        case NotificationType.N4:
        case NotificationType.N5:
        case NotificationType.N6:
        case NotificationType.N7:
        case NotificationType.N12: {
          content = Content[type];
          break;
        }
        case NotificationType.N8:
        case NotificationType.N9: {
          if (mintingEvent.type === EventType.WHITE_LIST) {
            socketToRoom = mintingEvent.whitelistInfo.address;
            createNotification.receiverAddresses =
              mintingEvent.whitelistInfo.address;
          } else {
            createNotification.address = SOCKET_ROOM.USER;
            socketToRoom = SOCKET_ROOM.USER;
          }
          const eventName = Utils.highlight(mintingEvent.name);
          content = Content[type].replace('%eventName%', eventName);
          createNotification.mintingEvent = this.convertToSimpleEvent(
            mintingEvent,
            null,
          );
          break;
        }
        case NotificationType.N10:
        case NotificationType.N11: {
          createNotification.address = socketToRoom;
         
          break;
        }
        case NotificationType.N13: {
          content = Content.N13.replace(
            '%userAddress%',
            Utils.highlight(Utils.getShortAddress(userAddress)),
          );
          break;
        }
        case NotificationType.N14: {
          content = Content.N14.replace(
            '%userAddress%',
            Utils.highlight(Utils.getShortAddress(userAddress)),
          ).replace(
            '%referralAddress%',
            Utils.highlight(Utils.getShortAddress(referralAddress)),
          );
          break;
        }
        case NotificationType.N15: {
          createNotification.transaction = transaction;
          content = Content.N15.replace(
            '%commissionFee%',
            Utils.highlight(Utils.formatCurrency(commissionFee)),
          )
            .replace(
              '%userAddress%',
              Utils.highlight(Utils.getShortAddress(userAddress)),
            )
            .replace('%role%', Utils.highlight(role));
          break;
        }
        case NotificationType.N16: {
          createNotification.transaction = transaction;
          content = Content.N16.replace(
            '%invalidNftName%',
            Utils.highlight(transaction.nft.name),
          )
            .replace(
              '%invalidTokenId%',
              Utils.highlight(transaction.faultyToken),
            )
            .replace('%recoverNftName%', Utils.highlight(transaction.nft.name))
            .replace('%recoverTokenId%', Utils.highlight(recoverTokenId));
          break;
        }
        case NotificationType.N17: {
          createNotification.transaction = transaction;
          content = Content.N17.replace(
            '%invalidNftName%',
            Utils.highlight(transaction.nft.name),
          ).replace(
            '%invalidTokenId%',
            Utils.highlight(transaction.faultyToken),
          );
          break;
        }
        default: {
          this.logger.error('pushNotificationUser(): wrong notification type');
          return;
        }
      }
      createNotification.type = type;
      createNotification.content = content;
      const notification = await createNotification.save({ session });
      this.logger.debug(
        `pushNotificationUser(): push socket to room ${socketToRoom}`,
      );
      // push to socket
      this.socketGateway.server
        .to(socketToRoom)
        .emit(SOCKET_EVENT.NOTIFICATION, notification);
    } catch (error) {
      this.logger.error(`pushNotificationUser(): fail`, error);
      this.logError(error);
    }
  }

  async pushNotificationAdmin(
    type: NotificationType,
    data: PushNotificationDto,
    session?: any,
  ) {
    try {
      const {
        toAddress,
        mintingEvent,
        transaction,
        nft,
      } = data;
      this.logger.log(`pushNotificationAdmin(): Push notification ${type}`);
      let eventName;
      let content;
      const createNotification = new this.notificationModel({ type });
      switch (type) {
        case NotificationType.P1:
          const quantity = Utils.highlight(transaction.quantity);
          const nftName = Utils.highlight(transaction.nft.name);
          const unitPrice = Utils.highlight(
            Utils.formatCurrency(transaction.event.category.unitPrice),
          );
          const address = Utils.highlight(
            Utils.getShortAddress(transaction.toAddress),
          );
          eventName = Utils.highlight(transaction.event.name);
          content = Content.P1.replace('%quantity%', quantity)
            .replace('%nftName%', nftName)
            .replace('%unitPrice%', unitPrice)
            .replace('%address%', address)
            .replace('%eventName%', eventName);
          createNotification.nft = nft;
          createNotification.mintingEvent = transaction.event;
          break;
        case NotificationType.P2:
          content = Content.P2.replace('%nftName%', nft.name);
          createNotification.nft = nft;
          break;
        case NotificationType.P3:
          content = Content.P3.replace(
            '%toAddress%',
            Utils.highlight(Utils.getShortAddress(toAddress)),
          );
          createNotification.toAddress = toAddress;
          break;
        case NotificationType.P4:
          eventName = Utils.highlight(mintingEvent.name);
          content = Content.P4.replace('%eventName%', eventName);
          createNotification.mintingEvent = this.convertToSimpleEvent(
            mintingEvent,
            null,
          );
          break;
        case NotificationType.P5:
        case NotificationType.P6:
          eventName = Utils.highlight(mintingEvent.name);
          content = Content[type].replace('%eventName%', eventName);
          createNotification.mintingEvent = this.convertToSimpleEvent(
            mintingEvent,
            null,
          );
          break;
        case NotificationType.P7:
        case NotificationType.P8:
        case NotificationType.P9:
        case NotificationType.P10:
        case NotificationType.P13:
          content = Content[type].replace('%eventName%', eventName);
   
          break;

        case NotificationType.P11:
          content = Content.P11;
          break;
        case NotificationType.P12:
          
    
          break;
        default:
          this.logger.error('pushNotificationAdmin(): wrong notification type');
          return;
      }
      const receiverAddresses = await this.getReceiverAddressesByType(type);
      createNotification.content = content;
      createNotification.receiverAddresses = receiverAddresses;
      const notification = await createNotification.save({ session });
      this.logger.debug(
        `pushNotificationAdmin(): push socket to list receiver ${receiverAddresses}`,
      );
      this.socketGateway.server
        .to(receiverAddresses)
        .emit(SOCKET_EVENT.NOTIFICATION, notification);
    } catch (error) {
      this.logger.error(`pushNotificationAdmin(): fail`, error);
      this.logError(error);
    }
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

  async getFilterDataToSyncTransaction(
    tokenStandard: TokenStandard,
    numBlockPerSync: number,
    numBlockSkipRangeToLatest: number,
  ) {
    const web3Gateway = new Web3Gateway();
    const latestBlock = await web3Gateway.getLatestBlock();
    const transactionTransferSyncs = await this.transactionTransferSyncModel
      .find({
        type: tokenStandard,
      })
      .sort({ toBlock: -1 })
      .limit(1);

    let fromBlock = 0;
    if (tokenStandard === TokenStandard.ERC_721) {
      fromBlock = Number(process.env.CONTRACT_ERC_721_FIRST_BLOCK);
    } else if (tokenStandard === TokenStandard.ERC_1155) {
      fromBlock = Number(process.env.CONTRACT_ERC_1155_FIRST_BLOCK);
    }
    if (transactionTransferSyncs.length > 0) {
      fromBlock = transactionTransferSyncs[0].toBlock + 1;
    }
    let toBlock = fromBlock + numBlockPerSync;
    if (toBlock >= latestBlock) {
      toBlock = latestBlock;
    }
    // Rangle fromBlock -> toBlock always is numBlockSkipRangeToLatest
    if (toBlock - fromBlock < numBlockSkipRangeToLatest) {
      fromBlock = toBlock - numBlockSkipRangeToLatest;
    }

    return { latestBlock, fromBlock, toBlock };
  }

  createTransactionTransferModel(
    tokenStandard: TokenStandard,
    event: Web3PastEvent,
  ) {
    const values = event.returnValues;
    if (tokenStandard === TokenStandard.ERC_721) {
      const fromAddress = values[0];
      const toAddress = values[1];
      const tokenId = values[2];
      const transactionTransfer = new this.transactionTransferModel({
        hash: event.transactionHash,
        logIndex: event.logIndex,
        type: tokenStandard,
        fromAddress,
        toAddress,
        tokenId,
        blockNumber: event.blockNumber,
        quantity: 1,
        status: TransactionTransferStatus.PENDING,
      });
      return transactionTransfer;
    } else if (tokenStandard === TokenStandard.ERC_1155) {
      const fromAddress = values[1];
      const toAddress = values[2];
      const tokenId = values[3];
      const quantity = values[4];
      const transactionTransfer = new this.transactionTransferModel({
        hash: event.transactionHash,
        logIndex: event.logIndex,
        type: tokenStandard,
        fromAddress,
        toAddress,
        tokenId,
        blockNumber: event.blockNumber,
        quantity,
        status: TransactionTransferStatus.PENDING,
      });
      return transactionTransfer;
    }
  }

  async createTransactionTransfer(data: {
    tokenStandard: TokenStandard;
    fromBlock: number;
    toBlock: number;
    latestBlock: number;
  }) {
    const { tokenStandard, fromBlock, toBlock, latestBlock } = data;
    const web3Gateway = new Web3Gateway();

    // Get past events
    let events: Web3PastEvent[] = [];
    if (tokenStandard === TokenStandard.ERC_721) {
      events = await web3Gateway.getPastEvents721(
        Contract.EVENT.TRANSFER,
        fromBlock,
        toBlock,
      );
    }
    const transactionTransfers = [];
    for (let index = 0; index < events.length; index++) {
      const event = events[index];
      const transactionTransferExist = await this.transactionTransferModel
        .findOne({
          hash: event.transactionHash,
          logIndex: event.logIndex,
        })
        .lean();
      if (!transactionTransferExist) {
        const transactionTransfer = this.createTransactionTransferModel(
          tokenStandard,
          event,
        );
        transactionTransfers.push(transactionTransfer);
      }
    }

    // Insert db
    const session = await this.connection.startSession();
    await session.withTransaction(async () => {
      const promises = [];

      // Re-sync one block
      if (latestBlock === -1) {
        promises.push(
          this.transactionTransferModel.deleteMany({
            blockNumber: fromBlock,
          }),
        );
      } else {
        // Add transaction transfer sync
        const transactionTransferSync = new this.transactionTransferSyncModel({
          type: tokenStandard,
          fromBlock,
          toBlock,
          latestBlock,
          totalTransactions: events.length,
          totalTransactionSyncs: transactionTransfers.length,
        });
        promises.push(transactionTransferSync.save({ session }));
      }

      // Add transaction transfer
      promises.push(
        this.transactionTransferModel.insertMany(transactionTransfers, {
          session,
        }),
      );

      await Promise.all(promises);
    });
    await session.endSession();

    return transactionTransfers;
  }

  async syncTransactionTransfer(
    tokenStandard: TokenStandard,
    numBlockPerSync = 1000,
    numBlockSkipRangeToLatest = 100,
  ) {
    // Get data
    const { latestBlock, fromBlock, toBlock } =
      await this.getFilterDataToSyncTransaction(
        tokenStandard,
        numBlockPerSync,
        numBlockSkipRangeToLatest,
      );
    if (fromBlock >= toBlock) {
      this.logger.debug(
        `syncTransactionTransfer(): ${tokenStandard} synced. Current block = ${fromBlock}, Latest block = ${latestBlock}`,
      );
      return;
    }
    this.logger.log(
      `Sync ${tokenStandard} from block ${fromBlock} -> ${toBlock}`,
    );
    const transactionTransfers = await this.createTransactionTransfer({
      tokenStandard,
      fromBlock,
      toBlock,
      latestBlock,
    });

    return transactionTransfers;
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
      token: this.convertToSimpleToken(nft),
      image: nft.image,
      royaltyFee: nft.royaltyFee,
      description: nft.description,
      noOfShare: nft.noOfShare,
      isNFTBlack: nft.isNFTBlack,
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

  async findEventById(id: any) {
    const event = await this.eventModel.findById(id);
    if (!event) {
      throw ApiError(ErrorCode.NO_DATA_EXISTS, 'Event not found');
    }
    if (event.isDeleted) {
      throw ApiError(ErrorCode.NO_DATA_EXISTS, 'Event is not exists');
    }
    return event;
  }


  getCategoryInEvent(event: EventDocument, nftId: any) {
    for (const itemCategory of event.categories) {
      if (itemCategory.nftId.toString() === nftId.toString()) {
        return itemCategory;
      }
    }

    throw ApiError(ErrorCode.INVALID_DATA, 'Category does not contain nftId');
  }

  convertToSimpleEvent(event: EventDocument, category: CategoryInEvent) {
    const simpleEvent: SimpleEvent = {
      id: event._id,
      category,
      creatorAddress: event.creatorAddress,
      name: event.name,
      imgUrl: event.imgUrl,
    };
    return simpleEvent;
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

  async getEventInfoByNFTId(id: string, requestData: any) {
    const pipe = [
      {
        $match: {
          $and: [
            { status: { $in: [EventStatus.LIVE, EventStatus.COMING_SOON] } },
            { 'categories.nftId': Utils.toObjectId(id) },
          ],
        },
      },
      {
        $addFields: {
          totalQuantityForSale: {
            $sum: '$categories.quantityForSale',
          },
          totalMinted: {
            $sum: '$categories.totalMinted',
          },
        },
      },
    ];
    return Utils.aggregatePaginate(this.eventModel, pipe, requestData);
  }
  //            A                    pathId[]
  //         A1   A2             A1: pathId[A] --- A2: pathId[A]
  //     A11         A21         A11: pathId[A,A1] --- A21: pathId[A,A2]
  // A111   A112   A211  A212    A111, A112: pathId[A,A1,A11] --- A211, A212: pathId[A,A2,A21]

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


  async getDataSignature(data: {
    referrer: string;
    signer: {
      address: string;
      privateKey: any;
    };
    nft: NFTDocument;
    quantityForSale: number;
    price: BigNumber;
    quantity: number;
    transactionId: any;
    event: EventDocument;
    toAddress: string;
    bdaOfBuyer: string;
    currencyAddress: string;
  }) {
    const {
      referrer,
      signer,
      nft,
      quantityForSale,
      price,
      quantity,
      transactionId,
      event,
      toAddress,
      bdaOfBuyer,
      currencyAddress,
    } = data;
    const web3Gateway = new Web3Gateway();
    const commissionRatio = referrer
      ? await this.findCommissionRatio()
      : DEFAULT_COMMISSION_RATIO;
    const bdaRatio = bdaOfBuyer ? await this.findBDARatio() : DEFAULT_BDA_RATIO;
    const referrerAddress = referrer ? referrer : DEFAULT_REFERRER;
    const bdaAddress = bdaOfBuyer ? bdaOfBuyer : DEFAULT_BDA;
    const dataSign = [
      nft.token.totalSupply + nft.token.totalBurnt,
      quantityForSale,
      price,
      quantity,
      commissionRatio,
      bdaRatio,
      toAddress,
      process.env.ADMIN_WALLET_ADDRESS,
      currencyAddress,
      process.env.CONTRACT_ERC_721,
      referrerAddress,
      bdaAddress,
      Utils.convertToBytes(nft.id),
      Utils.convertToBytes(transactionId.toString()),
      event.signature?.hash,
      `${process.env.BASE_URI}${nft.id}`,
    ];
    const signatureMint = await web3Gateway.sign(dataSign, signer.privateKey);
    const signature = <TransactionSignature>{
      data: dataSign,
      address: signer.address,
      hash: signatureMint,
      dataRequest: [
        [
          nft.token.totalSupply + nft.token.totalBurnt,
          quantityForSale, // total put on sale  --> total supply in event
          price, // price
          quantity, // amount
          Utils.convertDateToSeconds(event.startDate),
          Utils.convertDateToSeconds(event.endDate),
          commissionRatio,
          bdaRatio,
        ],
        [
          event.creatorAddress, // seller
          currencyAddress, // payment Token
          process.env.CONTRACT_ERC_721,
          process.env.ADMIN_WALLET_ADDRESS,
          referrerAddress, // referrer
          bdaAddress, // bda
        ],
        [
          Utils.convertToBytes(nft.id), // nft id
          Utils.convertToBytes(event.id), // transaction id (put on sale)  // TODO: change to eventId
          Utils.convertToBytes(transactionId.toString()), // transaction id (mint)
        ],
        [event.signature?.hash, signatureMint], // (0) saleOrderSignature, (1) signatureMint
        [`${process.env.BASE_URI}${nft.id}`],
      ],
    };
    return signature;
  }

  async getRecoverDataSignature(data: {
    collection: string;
    receiver: string;
    tokenId: number;
    nft: NFTDocument;
    transactionId: string | object;
    signer: {
      address: string;
      privateKey: any;
    };
  }) {
    const web3Gateway = new Web3Gateway();
    const { collection, receiver, nft, transactionId, signer, tokenId } = data;
    const dataSign = [
      collection,
      receiver,
      tokenId,
      Utils.convertToBytes(nft.id),
      Utils.convertToBytes(transactionId.toString()),
      `${process.env.BASE_URI}${process.env.NFT_INVALID}`,
      `${process.env.BASE_URI}${nft.id}`,
    ];
    const signatureRecover = await web3Gateway.sign(
      dataSign,
      signer.privateKey,
    );
    const signature = <TransactionSignature>{
      data: dataSign,
      address: signer.address,
      hash: signatureRecover,
      dataRequest: [
        [tokenId],
        [collection, receiver],
        [
          Utils.convertToBytes(nft.id),
          Utils.convertToBytes(transactionId.toString()),
          signatureRecover,
        ],
        [
          `${process.env.BASE_URI}${process.env.NFT_INVALID}`,
          `${process.env.BASE_URI}${nft.id}`,
        ],
      ],
    };
    return signature;
  }

  async getBDAOfUser(originator: string) {
    const isBda = await this.checkBda(originator);
    if (isBda) return originator;
    return;
  }



  async updateEventBuyNft(data: {
    transaction: TransactionDocument;
    nft: NFTDocument;
    event?: EventDocument;
    session: any;
  }) {
    const { transaction, nft, event, session } = data;
    const promises = [];
    if (transaction.status === TransactionStatus.SUCCESS) {
      const update = {};
      const { totalNftForSale, totalNftMinted } = this.checkEndEventBuy(event);
      if (totalNftForSale - totalNftMinted <= transaction.quantity) {
        update['$set'] = {
          status: EventStatus.END,
          endTimeOrigin: event.endDate,
          endDate: new Date(),
        };
        this.logger.debug(`updateNFT(): event ${event.id} is ended`);
        // push noti
        promises.push(
          this.pushNotificationAdmin(
            NotificationType.P5,
            {
              mintingEvent: event,
            },
            session,
          ),
        );
      }

      update['$inc'] = {
        totalRevenue: +transaction.revenue,
        adminEarnings: +transaction.adminEarning,
        'categories.$.totalMinted': +transaction.quantity,
      };
      promises.push(
        this.eventModel.findOneAndUpdate(
          {
            _id: event.id,
            status: EventStatus.LIVE,
            'categories.nftId': new ObjectID(nft.id),
          },
          update,
          {
            session: session,
            new: true,
          },
        ),
      );
      await Promise.all(promises);
    }
  }

  async calculateCommissionFee(transactionRevenue: any, bda: boolean) {
    const [percentBDARation, percentCommissionRatio] = await Promise.all([
      this.findBDARatio(),
      this.findCommissionRatio(),
    ]);
    if (bda) {
      return {
        percentage: percentBDARation / DEFAULT_DIVISOR,
        commissionFee: new BigNumber(transactionRevenue.toString())
          .multipliedBy(percentBDARation)
          .dividedBy(DEFAULT_DIVISOR)
          .toNumber(),
      };
    }
    return {
      percentage: percentCommissionRatio / DEFAULT_DIVISOR,
      commissionFee: new BigNumber(transactionRevenue.toString())
        .multipliedBy(percentCommissionRatio)
        .dividedBy(DEFAULT_DIVISOR)
        .toNumber(),
    };
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

  async getAffiliateInfor(userInfor: UserDocument, revenue: any) {
    const affiliateInfor = {};
    affiliateInfor['bda'] = {};
    affiliateInfor['referrerDirect'] = {};
    const [referrerInfo, originatorInfo] = await Promise.all([
      this.findUserByAddress(userInfor?.referrer),
      this.findUserByAddress(userInfor?.originator),
    ]);
    if (originatorInfo.userType === UserType.BDA) {
      const { commissionFee, percentage } = await this.calculateCommissionFee(
        revenue,
        true,
      );
      affiliateInfor['bda'] = {
        address: userInfor?.originator,
        commissionFee,
        percentage,
        role: originatorInfo.role,
      };
    }
    const { commissionFee, percentage } = await this.calculateCommissionFee(
      revenue,
      false,
    );
    affiliateInfor['referrerDirect'] = {
      address: userInfor?.referrer,
      commissionFee,
      percentage,
      role: referrerInfo.role,
    };
    return affiliateInfor;
  }

  async checkOffSaleNft(
    nftId: string,
    event: EventDocument,
    transactionQuantity: number,
  ) {
    const listEvent = await this.eventModel
      .find({
        'categories.nftId': ObjectID(nftId),
        _id: { $ne: event.id },
        status: EventStatus.LIVE,
      })
      .lean();
    const category = this.getCategoryInEvent(event, nftId);
    const nftRemainInCategory = category.quantityForSale - category.totalMinted;
    if (
      listEvent.length === 0 &&
      nftRemainInCategory - transactionQuantity === 0
    )
      return true;
    return false;
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

  // add queue for kyc job.
  async initKycQueue() {
    console.log('init kyc queue');
    this.kycQueue.process(async (job) => {
      try {
        // console.log('start to process with job: ', job);
        const id = job.data;
        const user = await this.userModel.findOne({
          address: id,
          'kycInfo.kycStatus': KYCStatus.VERIFIED,
          $or: [
            { 'kycInfo.kycPhotos.selfieUrl': '' },
            { 'kycInfo.kycPhotos.documentUrl': '' },
          ],
        });
        // TODO:
        if (user) {
          console.log(`process with user: ${user._id}, ${user.address}`);
          // find single candiate with refId.
          const userInform = await this.singleCandidateKyc(
            process.env.CLIENT_ID,
            id,
            process.env.API_KEY,
          );
          if (userInform) {
            const countryCode = userInform.identities
              .national_id_issuing_country?.value
              ? userInform.identities.national_id_issuing_country.value
              : userInform.identities.driving_license_issuing_country?.value
              ? userInform.identities.driving_license_issuing_country.value
              : userInform.identities.passport_issuing_country?.value
              ? userInform.identities.passport_issuing_country.value : ''; // Thiếu với trường hợp passport

            // (user.kycInfo.email = userInform.identities?.email?.value);
            user.kycInfo.email = userInform.identities?.email?.value;
            user.kycInfo.fullName = `${userInform.identities?.family_name?.value} ${userInform.identities?.given_name?.value}`;
            user.kycInfo.residentialAddress =
              userInform.identities?.address?.value;
            user.kycInfo.countryCode = countryCode;
            user.kycInfo.nationality = countries[countryCode]?.name;
            user.kycInfo.dateOfBirth = new Date(
              userInform.identities?.dob?.value,
            );
            const kycDocument = userInform.identities?.national_id_number?.value
              ? userInform.identities.national_id_number.value
              : userInform.identities?.driving_license_number?.value
              ? userInform.identities.driving_license_number.value
              : userInform.identities?.passport_number.value;
            user.kycInfo.kycDocument = kycDocument;
            user.save();
            if (userInform.identities?.selfie?.value) {
              const buf = Buffer.from(
                userInform.identities?.selfie?.value,
                'base64',
              );
              const urlSelfie = await AwsUtils.uploadS3(
                buf,
                'image/jpeg',
                `kyc/selfie/${id}`,
                true,
              );
              user.kycInfo.kycPhotos.selfieUrl = urlSelfie;
            }

            const documentBase64 = userInform.identities?.national_id?.value
              ? userInform.identities.national_id.value
              : userInform.identities?.driving_license?.value
              ? userInform.identities.driving_license.value
              : userInform.identities?.passport.value;
            if (documentBase64) {
              const bufDoc = Buffer.from(documentBase64, 'base64');
              const urlDoc = await AwsUtils.uploadS3(
                bufDoc,
                'image/jpeg',
                `kyc/Document/${id}`,
                true,
              );
              user.kycInfo.kycPhotos.documentUrl = urlDoc;
            }
            if (userInform.identities?.selfie?.value || documentBase64) {
              user.save();
            }
          }
        }
      } catch (error) {
        return Promise.reject(error);
      }
    });
    this.kycQueue.on('succeeded', (job, result) => {
      // prettier-ignore
      this.logger.log(`Check kyc ${job.id} succeeded.`);
    });
    this.kycQueue.on('failed', async (job, err) => {
      console.log('job id: ', job.id);
      const dateTime = new Date();
      dateTime.setDate(dateTime.getDate() - 1);
      const userJob = await this.userModel
        .findOne({
          address: { $regex: job.id, $options: 'i' },
          createdAt: { $gt: new Date(dateTime) },
        })
        .lean();
      if (!userJob) {
        await job.remove();
      }
      this.logger.error(`Check kyc ${job.id} failed: ${err.message}`);
      this.logError(err);
    });

    // Init data when restart server
    const users = await this.userModel.find({
      'kycInfo.kycStatus': KYCStatus.VERIFIED,
      $or: [
        { 'kycInfo.kycPhotos.selfieUrl': '' },
        { 'kycInfo.kycPhotos.documentUrl': '' },
      ],
    });
    console.log('number of user already verified: ', users?.length);
    for (let index = 0; index < users.length; index++) {
      const user = users[index];
      const currentJob = await this.kycQueue.getJob(user.address);
      if (currentJob) {
        await currentJob.remove();
      }
      await this.addQueueKyc(user);
    }
  }
  async addQueueKyc(user: UserDocument) {
    console.log(`Add Queue Check kyc for userId: ${user.address}`);
    this.logger.log(`Add Queue Check kyc for userId: ${user.address}`);
    const currentJob = await this.kycQueue.getJob(user.address);
    if (currentJob) {
      return;
    }
    console.log('user inform: ', JSON.stringify(user));
    const job = this.kycQueue
      .createJob(user.address)
      .setId(user.address)
      .delayUntil(moment().add(2, 'm').toDate())
      .retries(100000000000000000000)
      .backoff('fixed', 5000);
    await job.save();
  }



  


  checkEndEventBuy(event: EventDocument) {
    const totalNftForSale = event.categories.reduce(
      (acc, value) => acc + value.quantityForSale,
      0,
    );
    const totalNftMinted = event.categories.reduce(
      (acc, value) => acc + value.totalMinted,
      0,
    );
    return {
      totalNftForSale,
      totalNftMinted,
    };
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

  async getDataSignatureAdminMint(
    receiver: string,
    nftId: string,
    transactionId,
  ) {
    const dataSign = [
      process.env.CONTRACT_ERC_721,
      receiver,
      Utils.convertToBytes(nftId),
      Utils.convertToBytes(transactionId.toString()),
      `${process.env.BASE_URI}${nftId}`,
    ];
    const web3Gateway = new Web3Gateway();
    const signer = await this.findSigner();
    const signatureAdminMint = await web3Gateway.sign(
      dataSign,
      signer.privateKey,
    );
    const signature = <TransactionSignature>{
      data: dataSign,
      address: signer.address,
      hash: signatureAdminMint,
      dataRequest: [
        process.env.CONTRACT_ERC_721, // Address
        receiver,
        Utils.convertToBytes(nftId),
        Utils.convertToBytes(transactionId.toString()),
        signatureAdminMint,
        `${process.env.BASE_URI}${nftId}`,
      ],
    };
    return signature;
  }

  async userWithRoleCompany() {
    const user = await this.userModel.findOne({ role: UserRole.SYSTEM });
    if (!user) {
      throw ApiError(ErrorCode.NO_DATA_EXISTS, 'User not found');
    }
    return user;
  }

  async updateTransferBlackDiamond(data: {
    transaction: TransactionDocument;
    nft: NFTDocument;
    session: any;
  }) {
    const { transaction, nft, session } = data;
    const { fromAddress } = transaction;
    try {
      return Promise.all([
        this.updateTransporter({
          fromAddress,
          actionType: ActionType.TRANSFER_BLACK_NFT,
          transaction,
          session,
        }),
        this.updateReceiverBlackDiamond({ transaction, nft, session }),
      ]);
    } catch (error) {
      throw error;
    }
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

  async updateReceiverBlackDiamond(data: {
    transaction: TransactionDocument;
    nft: NFTDocument;
    session: any;
  }) {
    const { nft, session, transaction } = data;
    const { toAddress, tokenIds } = transaction;
    let receiver;
    const promises = [];
    promises.push(
      this.updateOwnerTransferNft(tokenIds[0], toAddress, session, nft._id),
    );
    try {
      receiver = await this.findUserByAddress(toAddress);
    } catch (exception) {
      return Promise.all(promises);
    }

    if (receiver.userType === UserType.BDA) {
      return Promise.all(promises);
    }

    if (
      new BigNumber(receiver.oldPersonalVolume.toString()).gte(
        CONFIG_TO_BECOME_BDA,
      ) ||
      new BigNumber(receiver.personalVolume.toString()).gte(
        CONFIG_TO_BECOME_BDA,
      )
    ) {
      const children = this.updateUserBecomeBDA(receiver, session);
      receiver.userType = UserType.BDA;
      if (
        new BigNumber(receiver.personalVolume.toString()).gte(
          CONFIG_TO_BECOME_BDA,
        )
      ) {
        receiver.haveReceivedBlackFromAdmin = false;
        promises.push(
          this.pushNotificationUser(
            NotificationType.N3,
            { toAddress: receiver.address },
            session,
          ),
        );
      } else {
        promises.push(
          this.pushNotificationUser(
            NotificationType.N4,
            { toAddress: receiver.address },
            session,
          ),
          this.pushNotificationAdmin(
            NotificationType.P3,
            {
              toAddress: receiver.address,
            },
            session,
          ),
        );
      }

      promises.push(receiver.save({ session }));
      promises.push(...children);
    }
    return Promise.all(promises);
  }

  canRegainBDAAfterTransfering(data: { userInfo: UserDocument }) {
    const { userInfo } = data;
    switch (userInfo.haveReceivedBlackFromAdmin) {
      case true:
        return (
          userInfo.userType === UserType.COMMON &&
          new BigNumber(userInfo.personalVolume.toString()).gte(
            CONFIG_TO_BECOME_BDA,
          )
        );
      case false:
        return (
          userInfo.userType === UserType.COMMON &&
          (new BigNumber(userInfo.oldPersonalVolume.toString()).gte(
            CONFIG_TO_BECOME_BDA,
          ) ||
            new BigNumber(userInfo.personalVolume.toString()).gte(
              CONFIG_TO_BECOME_BDA,
            ))
        );
    }
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
    if (this.canRegainBDAAfterTransfering({ userInfo: receiver })) {
      const children = this.updateUserBecomeBDA(receiver, session);
      receiver.userType = UserType.BDA;
      if (
        new BigNumber(receiver.personalVolume.toString()).gte(
          CONFIG_TO_BECOME_BDA,
        )
      ) {
        receiver.haveReceivedBlackFromAdmin = false;
        // ADD NOTIFICATION ADMIN
        promises.push(
          this.pushNotificationUser(
            NotificationType.N3,
            { toAddress: receiver.address },
            session,
          ),
        );
      } else {
        promises.push(
          this.pushNotificationUser(
            NotificationType.N4,
            { toAddress: receiver.address },
            session,
          ),
        );
      }
      promises.push(
        this.pushNotificationAdmin(
          NotificationType.P3,
          {
            toAddress: receiver.address,
          },
          session,
        ),
      );

      promises.push(receiver.save({ session }));
      promises.push(...children);
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

  async createTransactionAdminAction(
    data: {
      account: string;
      action: string;
      permissions: string[];
      adminName?: string;
    },
    session?: any,
  ) {
    const { account, permissions, action, adminName } = data;

    const transactionId = Utils.createObjectId();

    const signature = await this.getSignatureAdminAction(
      account,
      action,
      permissions,
      transactionId,
    );
    const typeTransactionMapper = {
      [AdminActions.ADD_ADMIN]: TransactionType.ADMIN_SETTING,
      [AdminActions.UPDATE_ADMIN]: TransactionType.ADMIN_UPDATE,
      [AdminActions.ACTIVATE]: TransactionType.ADMIN_ACTIVE,
      [AdminActions.DEACTIVATE]: TransactionType.ADMIN_DEACTIVE,
      [AdminActions.DELETE_ADMIN]: TransactionType.ADMIN_DELETE,
    };
    return this.transactionModel.create(
      [
        {
          _id: transactionId,
          type: typeTransactionMapper[action],
          toAddress: account,
          status: TransactionStatus.DRAFT,
          signature: signature,
          dataAdminTemp: {
            adminName,
            address: account,
            permissions,
            status: UserStatus.DRAFT,
            role: UserRole.ADMIN,
            isHavingAction: false,
          },
        },
      ],
      { session },
    );
  }

  async getSignatureAdminAction(
    account: string,
    action: string,
    permissions: string[],
    transactionId: object,
  ) {
    const permissionMapper = permissions.map(
      (item) => process.env[AdminPermissions[item]],
    );
    const actionMapper = process.env[AdminActions[action]];
    const dataSign = [
      account,
      actionMapper,
      permissionMapper,
      Utils.convertToBytes(transactionId.toString()),
    ];
    const web3Gateway = new Web3Gateway();
    const signer = await this.findSigner();
    const hash = await web3Gateway.sign(dataSign, signer.privateKey);
    const signature = <TransactionSignature>{
      data: dataSign,
      address: signer.address,
      hash: hash,
      dataRequest: [
        account,
        actionMapper,
        permissionMapper,
        Utils.convertToBytes(transactionId.toString()),
        hash,
      ],
    };
    return signature;
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
          transaction.message = requestData?.message || '';
          if (requestData.isFromWorker) {
            transaction.syncedAt = new Date();
          }
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
                  adminName: transaction.dataAdminTemp?.adminName,
                  permissions: transaction.dataAdminTemp?.permissions,
                  isHavingAction: transaction.dataAdminTemp?.isHavingAction,
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
      case TransactionType.ADMIN_UPDATE:
        promises.push(
          this.userModel.findOneAndUpdate(
            {
              type: UserRole.ADMIN,
              address: transaction.toAddress,
              isDeleted: false,
            },
            {
              adminName: transaction.dataAdminTemp?.adminName,
              permissions: transaction.dataAdminTemp?.permissions,
            },
            {
              session,
              new: true,
            },
          ),
        );
        break;
      case TransactionType.ADMIN_ACTIVE:
      case TransactionType.ADMIN_DEACTIVE:
        const statusMapper = {
          [TransactionType.ADMIN_ACTIVE]: UserStatus.ACTIVE,
          [TransactionType.ADMIN_DEACTIVE]: UserStatus.DEACTIVE,
        };
        promises.push(
          this.userModel.findOneAndUpdate(
            {
              type: UserRole.ADMIN,
              address: transaction.toAddress,
              isDeleted: false,
            },
            {
              adminName: transaction.dataAdminTemp?.adminName,
              status: statusMapper[transaction.type],
              permissions: transaction.dataAdminTemp?.permissions,
            },
            {
              session,
              new: true,
            },
          ),
        );
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
      case TransactionType.ADMIN_ACTIVE:
      case TransactionType.ADMIN_DEACTIVE:
        const mapper = {
          [TransactionType.ADMIN_ACTIVE]: UserStatus.DEACTIVE,
          [TransactionType.ADMIN_DEACTIVE]: UserStatus.ACTIVE,
        };
        return promises.push(
          this.userModel.findOneAndUpdate(
            {
              type: UserRole.ADMIN,
              address: transaction.toAddress,
              isDeleted: false,
              status: UserStatus.PROCESSING,
            },
            {
              status: mapper[transaction.type],
            },
            {
              session,
              new: true,
            },
          ),
        );
      case TransactionType.ADMIN_DELETE:
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

  async createAdmin(data: AdminTemp, session: any) {
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
        {
          $group: {
            _id: null,
            totalLocking: { $sum: '$nft.noOfShare' },
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
}

import { Injectable, Logger } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { WorkerDataDto } from './dto/worker-data.dto';
import { Contract, THOUSAND } from 'src/common/constants';
import { CommonService } from 'src/common-service/common.service';
import { TransactionStatus } from 'src/schemas/Transaction.schema';
import { TransferDto } from './dto/transfer.dto';
import { AdminMintDto } from './dto/admin-mint.dto';
import { BuyNFTDto } from './dto/buy-nft.dto';
import { Utils } from 'src/common/utils';
import { NFT, NFTDocument, Owner, TokenStandard } from 'src/schemas/NFT.schema';
import { SyncTransactionDto } from './dto/sync-transaction.dto';
import {
  TransactionTransfer,
  TransactionTransferDocument,
} from 'src/schemas/TransactionTransfer.schema';
import { User, UserDocument, UserRole } from 'src/schemas/User.schema';
import mongoose from 'mongoose';
import { RedemptionFromWorkerDto } from './dto/redemption-from-worker.dto';
import { EventFromWorkerDto } from './dto/event-from-worker.dto';
import { EventLockDto } from './dto/event-lock.dto';
import { PermissionAdmin } from './dto/permission-admin.dto';
import { ClaimedDto } from './dto/claimed.dto';
import { TransactionsService } from 'src/transactions/transactions.service';
import { DepositDto } from './dto/deposit.dto';
import { RecoverMintedDto } from './dto/recover-minted.dto';
const jwt = require('jsonwebtoken');

@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name);

  constructor(
    @InjectConnection() private readonly connection: mongoose.Connection,
    private commonService: CommonService,
    @InjectModel(NFT.name)
    private nftModel: Model<NFTDocument>,
    @InjectModel(TransactionTransfer.name)
    private transactionTransferModel: Model<TransactionTransferDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private readonly transactionService: TransactionsService,
  ) {}

  async syncAllTransactions(requestData: SyncTransactionDto) {
    while (true) {
      const transactions = await this.commonService.syncTransactionTransfer(
        requestData.type,
        5000,
        100,
      );
      if (!transactions || transactions.length === 0) {
        break;
      }
      await Utils.wait(300);
    }
  }

  async getTransferTokens(data: {
    tokenStandard: TokenStandard;
    isReceived: boolean;
  }) {
    const { tokenStandard, isReceived } = data;
    const match: any = {};
    if (isReceived) {
      match['$match'] = {
        type: tokenStandard,
        toAddress: {
          $ne: Contract.ZERO_ADDRESS,
        },
      };
    } else {
      match['$match'] = {
        type: tokenStandard,
        fromAddress: {
          $ne: Contract.ZERO_ADDRESS,
        },
      };
    }
    const pipe = [
      {
        $lookup: {
          from: 'nfts',
          localField: 'tokenId',
          foreignField: 'token.ids',
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$token.standard', tokenStandard],
                },
              },
            },
          ],
          as: 'nft',
        },
      },
      {
        $unwind: '$nft',
      },
      match,
      {
        $group: {
          _id: {
            nftId: '$nft._id',
            address: isReceived ? '$toAddress' : '$fromAddress',
          },
          tokenIds: {
            $push: '$tokenId',
          },
          quantity: {
            $sum: '$quantity',
          },
        },
      },
      {
        $project: {
          _id: 0,
          nftId: '$_id.nftId',
          address: '$_id.address',
          tokenIds: 1,
          quantity: 1,
        },
      },
    ];

    this.logger.debug(`getTransferTokens(): pipe`, JSON.stringify(pipe));
    return this.transactionTransferModel.aggregate(pipe);
  }

  async getBurnTokens(requestData: SyncTransactionDto) {
    const pipe = [
      {
        $match: {
          type: requestData.type,
          toAddress: Contract.ZERO_ADDRESS,
        },
      },
      {
        $lookup: {
          from: 'nfts',
          localField: 'tokenId',
          foreignField: 'token.ids',
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$token.standard', requestData.type],
                },
              },
            },
          ],
          as: 'nft',
        },
      },
      {
        $unwind: '$nft',
      },
      {
        $group: {
          _id: '$nft._id',
          tokenIds: {
            $push: '$tokenId',
          },
          quantity: {
            $sum: '$quantity',
          },
        },
      },
      {
        $project: {
          _id: 0,
          nftId: '$_id',
          tokenIds: 1,
          quantity: 1,
        },
      },
    ];
    this.logger.debug(`getBurnTokens(): pipe`, JSON.stringify(pipe));
    return this.transactionTransferModel.aggregate(pipe);
  }

  async getMintedAddress() {
    const pipe = [
      {
        $match: {
          type: TokenStandard.ERC_721,
          fromAddress: Contract.ZERO_ADDRESS,
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'toAddress',
          foreignField: 'address',
          as: 'user',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          address: '$toAddress',
          tokenId: 1,
          role: '$user.role',
        },
      },
    ];
    this.logger.debug(`getMintedAddress(): pipe`, JSON.stringify(pipe));
    return this.transactionTransferModel.aggregate(pipe);
  }

  async getOwnerFromTransactionTranfer(requestData: SyncTransactionDto) {
    // Get transfer token was sent
    const tokenSends = await this.getTransferTokens({
      tokenStandard: requestData.type,
      isReceived: false,
    });
    const mapNftAddressToken = new Map(
      tokenSends.map((obj) => [`${obj.nftId}-${obj.address}`, obj]),
    );

    // Get transfer token was received
    const tokenReceiveds = await this.getTransferTokens({
      tokenStandard: requestData.type,
      isReceived: true,
    });
    let mapTokenMintedAddress = new Map<string, string>();
    let mapAddressRole = new Map<string, boolean>();
    if (requestData.type === TokenStandard.ERC_721) {
      const [mintedAddresses, users] = await Promise.all([
        this.getMintedAddress(),
        this.userModel.find(),
      ]);
      mapTokenMintedAddress = new Map(
        mintedAddresses.map((obj) => [obj.tokenId, obj.address]),
      );
      mapAddressRole = new Map(
        users.map((obj) => [
          obj.address,
          obj.role === UserRole.ADMIN || obj.role === UserRole.SUPER_ADMIN,
        ]),
      );
    }

    // Create NFT Owners
    const mapNftOwners = new Map<string, Owner[]>();
    for (let index = 0; index < tokenReceiveds.length; index++) {
      const tokenReceived = tokenReceiveds[index];
      const nftId = tokenReceived.nftId.toString();
      const address = tokenReceived.address;
      let tokenIds: string[] = tokenReceived.tokenIds;
      let quantity = tokenReceived.quantity;

      // Get current tokenIds, quantity
      const key = `${nftId}-${address}`;
      if (mapNftAddressToken.has(key)) {
        const tokenSend = mapNftAddressToken.get(key);
        if (requestData.type === TokenStandard.ERC_721) {
          tokenIds = tokenIds.filter((tokenId) => {
            return !tokenSend.tokenIds.includes(tokenId);
          });
        } else if (requestData.type === TokenStandard.ERC_1155) {
          quantity = quantity - tokenSend.quantity;
        }
      }

      // Group owner into nft
      const owners = mapNftOwners.get(nftId) || [];
      if (requestData.type === TokenStandard.ERC_721) {
        owners.push(
          ...tokenIds.map((tokenId) => {
            const mintedAddress = mapTokenMintedAddress.get(tokenId);
            return {
              tokenId: tokenId,
              address: address,
              isAddressAdmin: mapAddressRole.get(address) || false,
              mintedAddress: mintedAddress,
              isMintedAddressAdmin: mapAddressRole.get(mintedAddress) || false,
            } as Owner;
          }),
        );
      }
      mapNftOwners.set(nftId, owners);
    }

    return mapNftOwners;
  }

  async generateToken() {
    const payload = { address: 'worker', role: UserRole.WORKER };
    const token = jwt.sign(payload, process.env.JWT_SECRET);
    return { token };
  }

  async syncTransactionsInBlock(requestData: SyncTransactionDto) {
    const transactions = await this.commonService.createTransactionTransfer({
      tokenStandard: requestData.type,
      fromBlock: requestData.blockNumber,
      toBlock: requestData.blockNumber,
      latestBlock: -1,
    });

    return transactions;
  }

  async syncTransactions(requestData: SyncTransactionDto) {
    // Sync transaction from block chain
    await this.syncAllTransactions(requestData);

    // Get owner
    const mapNftOwners = await this.getOwnerFromTransactionTranfer(requestData);
    const nftIds = [...mapNftOwners.keys()];

    // Update DB
    const session = await this.connection.startSession();
    await session.withTransaction(async () => {
      // Clear tokenIds, owners
      await this.nftModel.updateMany(
        {
          _id: { $in: nftIds },
        },
        {
          $set: {
            owners: [],
          },
        },
        {
          session,
        },
      );

      // Update owners
      const promises = [];
      for (const [nftId, owners] of mapNftOwners.entries()) {
        promises.push(
          this.nftModel.updateOne(
            {
              _id: Utils.toObjectId(nftId),
            },
            {
              $set: {
                owners: owners.sort(
                  (a, b) => Number(a.tokenId) - Number(b.tokenId),
                ),
              },
            },
            {
              session,
            },
          ),
        );
      }

      const result = await Promise.all(promises);
      this.commonService.logPromise(promises, result);
    });
    await session.endSession();

    return {
      totalNfts: nftIds.length,
      nftIds,
      nft: nftIds.map((nftId) => {
        return {
          id: nftId,
          total: mapNftOwners.get(nftId).length,
          owners: mapNftOwners.get(nftId),
        };
      }),
    };
  }

  async receivedData(requestData: WorkerDataDto) {
    switch (requestData.eventType) {
      case Contract.EVENT.ADMIN_MINT_NFT:
        // ADMIN MINT NFT
        const dataAdminMint = requestData.data as AdminMintDto;
        return this.commonService.adminMintNFT(
          Utils.convertBytesToString(dataAdminMint.transactionId),
          {
            hash: requestData.hash,
            message: '',
            status: TransactionStatus.SUCCESS,
            isFromWorker: true,
          },
          dataAdminMint.tokenIds,
        );
      case Contract.EVENT.MINT_NFT:
        // BUY NFT
        const dataMint = requestData.data as BuyNFTDto;
        const tokenIds = dataMint.tokenIds ? dataMint.tokenIds : [];
        return this.commonService.buyNFT(
          Utils.convertBytesToString(dataMint.transactionId),
          {
            hash: requestData.hash,
            message: '',
            status: TransactionStatus.SUCCESS,
            isFromWorker: true,
          },
          tokenIds,
        );
      case Contract.EVENT.TRANSFER:
        // TRANSFER 721
        const data = requestData.data as TransferDto;
        data.hash = requestData.hash;
        return this.commonService.transferNFT721(data);
      case Contract.EVENT.REDEMPTION_SUBMITTED:
      case Contract.EVENT.REDEMPTION_CANCELED:
      case Contract.EVENT.REDEMPTION_APPROVE:
        const dataRedemption = requestData.data as RedemptionFromWorkerDto;
        const transactionRedemption =
          await this.commonService.findTransactionById(
            Utils.convertBytesToString(dataRedemption.transactionId),
          );
        return this.commonService.updateRedemption(transactionRedemption, {
          isFromWorker: true,
          hash: requestData.hash,
          status: TransactionStatus.SUCCESS,
        });
      case Contract.EVENT.EVENT_CANCELED:
        const dataEvent = requestData.data as EventFromWorkerDto;
        const transactionEvent = await this.commonService.findTransactionById(
          Utils.convertBytesToString(dataEvent.transactionId),
        );
        return this.commonService.cancelEvent(transactionEvent, {
          isFromWorker: true,
          hash: requestData.hash,
          status: TransactionStatus.SUCCESS,
        });
      case Contract.EVENT.PERMISSION_UPDATE:
        const dataPermissionAdmin = requestData.data as PermissionAdmin;
        const transaction = await this.commonService.findTransactionById(
          Utils.convertBytesToString(dataPermissionAdmin.transactionId),
        );
        return this.commonService.updateAdminAction(transaction, {
          isFromWorker: true,
          hash: requestData.hash,
          status: TransactionStatus.SUCCESS,
        });
      case Contract.EVENT.DEPOSITED:
        const dataDeposit = requestData.data as DepositDto;
        const transactionDeposit = await this.commonService.findTransactionById(
          Utils.convertBytesToString(dataDeposit.transactionId),
        );
        return this.commonService.deposit(transactionDeposit, {
          isFromWorker: true,
          hash: requestData.hash,
          status: TransactionStatus.SUCCESS,
        });
      default:
        this.logger.error(`Event ${requestData.eventType} not handle`);
        break;
    }
  }
}

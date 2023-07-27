import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, Promise } from 'mongoose';
import { UserJWT } from 'src/auth/role.enum';
import { CommonService } from 'src/common-service/common.service';
import { ErrorCode, THREE_MINUTES } from 'src/common/constants';
import { Utils } from 'src/common/utils';
import { AttributeType, AttributeTypeUser } from 'src/schemas/Config.schema';
import { NFT, NFTDocument, NFTStatus } from 'src/schemas/NFT.schema';
import { Owner, OwnerDocument } from 'src/schemas/Owner.schema';
import slugify from 'slugify';
import {
  Transaction,
  TransactionDocument,
  TransactionStatus,
  TransactionType,
} from 'src/schemas/Transaction.schema';
import { OwnerStatus } from './../schemas/NFT.schema';
import {
  FindNftDto as FindNftAdminDto,
  NftType,
} from './dto/admin/find-nft.dto';
import { FindItemOwnerDto } from './dto/user/find-item-owner.dto';
import { FindTokensCanRedeemDto } from './dto/user/find-tokens-can-redeem.dto';
import { FindTransactionDto } from './dto/user/find-transaction.dto';
import { CreateNftDto } from './dto/admin/create-nft.dto';
import { ApiError } from 'src/common/api';
import { CounterName } from 'src/schemas/Counter.schema';
import { IpfsClientType } from 'src/providers/ipfs/ipfs.type';
import { IpfsGateway } from 'src/providers/ipfs/ipfs.gateway';
import { MintNftDto } from './dto/user/mint-nft.dto';

@Injectable()
export class NftsService {
  private readonly logger = new Logger(NftsService.name);

  constructor(
    @InjectConnection() private readonly connection: mongoose.Connection,
    @InjectModel(NFT.name)
    private nftModel: Model<NFTDocument>,

    @InjectModel(Transaction.name)
    private transactionModel: Model<TransactionDocument>,
    private commonService: CommonService,
    @InjectModel(Owner.name)
    private ownerModel: Model<OwnerDocument>,
  ) {}

  /**
   * Create Search attribute
   * @param {any} attributes
   * @return {any}
   */
  async createSearchAttributes(attributes: any) {
    const match: any = [];
    const config = await this.commonService.findFullConfig();
    for (const [key, value] of Object.entries(attributes)) {
      if (!value || value === '') {
        continue;
      }
      const attributeMaster = config.attributes[key];
      if (!attributeMaster) {
        continue;
      }

      let keySearch = `attributes.${key}`;
      let valueSearch;
      if (attributeMaster.type === AttributeType.RANGE) {
        valueSearch = { $lte: Number(value) };
      } else if (attributeMaster.type === AttributeType.SELECT) {
        keySearch = `${keySearch}.text`;
        if (attributeMaster.typeUser === AttributeTypeUser.CHECKBOX_GROUP) {
          valueSearch = { $in: value.toString().split(',') };
        } else {
          valueSearch = value;
        }
      } else if (attributeMaster.type === AttributeType.TEXT) {
        valueSearch = { $regex: value, $options: 'i' };
      }

      match.push({
        [keySearch]: valueSearch,
      });
    }
    return match;
  }

  projectNFTListing() {
    return {
      $project: {
        code: 1,
        name: 1,
        slug: 1,
        image: 1,
        media: 1,
        attributes: 1,
        createdAt: 1,
        updatedAt: 1,
        unitPrice: 1,
        usd: 1,
        currency: 1,
        totalSupply: 1,
        totalForSale: 1,
        totalNotForSale: {
          $subtract: ['$totalSupply', '$totalForSale'],
        },
        status: {
          $cond: {
            if: { $gt: ['$totalForSale', 0] },
            then: NFTStatus.ON_SALE,
            else: NFTStatus.OFF_SALE,
          },
        },
      },
    };
  }

  calculateTotalNFTListing(pipe: mongoose.PipelineStage[]) {
    return this.nftModel.aggregate([
      ...pipe,
      {
        $project: {
          countForSale: {
            $cond: [{ $gt: ['$totalForSale', 0] }, 1, 0],
          },
          countNotForSale: {
            $cond: [{ $eq: ['$totalForSale', 0] }, 1, 0],
          },
        },
      },
      {
        $group: {
          _id: 'null',
          totalForSale: {
            $sum: '$countForSale',
          },
          totalNotForSale: {
            $sum: '$countNotForSale',
          },
        },
      },
    ]);
  }

  async findOne(id: string) {
    const pipeLine = [
      {
        $match: {
          _id: Utils.toObjectId(id),
        },
      },
      {
        $project: {
          image: 1,
          name: 1,
          description: 1,
          cid: '$token.cid',
        },
      },
    ];

    const result = await Utils.aggregatePaginate(this.nftModel, pipeLine, null);
    return result;
  }

  async findNFTDetailUser(address: string, id: string) {
    const pipeLine = [
      {
        $match: {
          _id: Utils.toObjectId(id),
        },
      },
      {
        $set: {
          onSaleQuantity: {
            $subtract: [
              '$token.totalSupply',
              {
                $add: ['$token.totalAvailable', '$token.totalMinted'],
              },
            ],
          },
          totalBurned: { $sum: '$token.totalBurnt' },
        },
      },
    ];

    const result = await Utils.aggregatePaginate(this.nftModel, pipeLine, null);
    return result;
  }

  async findAll(requestData: FindNftAdminDto) {
    const pipe: mongoose.PipelineStage[] = [];
    const conditionMatch: any = [{ isDeleted: false }];

    pipe.push(
      { $match: { $and: conditionMatch } },
      {
        $project: {
          name: 1,
          code: 1,
          image: 1,
          totalSupply: '$token.totalSupply',
          totalMinted: '$token.totalMinted',
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
          description: 1,
          ipfsImage: 1,
          ipfsMetadata: 1,
          price: 1
        },
      },
    );
    return Utils.aggregatePaginate(this.nftModel, pipe, requestData);
  }

  findTransactions(id: string, requestData: FindTransactionDto, user: UserJWT) {
    // Validate
    if (requestData.isMyHistory && !user) {
      throw new UnauthorizedException();
    }

    const conditionAnd: mongoose.FilterQuery<TransactionDocument>[] = [
      {
        'nft.id': Utils.toObjectId(id),
        status: TransactionStatus.SUCCESS,
        type: {
          $in: [
            TransactionType.LISTED,
            TransactionType.CANCELED,
            TransactionType.MINTED,
            TransactionType.TRANSFER,
          ],
        },
      },
    ];
    // Search by type
    if (requestData.type) {
      conditionAnd.push({ type: requestData.type });
    }
    // Search my sale order
    if (requestData.isMyHistory) {
      conditionAnd.push({
        $or: [{ fromAddress: user.address }, { toAddress: user.address }],
      });
    }
    const match = {
      $and: conditionAnd,
    };

    return Utils.paginate(this.transactionModel, match, requestData);
  }

  async findOwned(user: UserJWT, id: string, requestData: FindItemOwnerDto) {
    return this.commonService.findOwned(user, id, requestData);
  }

  async findOwnerNft(address: string) {
    const pipeline = [
      {
        $match: {
          address: address,
        },
      },
      {
        $lookup: {
          from: 'nfts',
          localField: 'nftId',
          foreignField: '_id',
          as: 'nfts',
        },
      },
      { $unwind: '$nfts' },
      // {
      //   $project: {
      //     _id: '$nfts._id',
      //     name: '$nfts.name',
      //     ipfsImage: '$nfts.ipfsImage',
      //     // totalItem: '$totalItem',
      //     // lastDateBought: '$lastDateBought',
      //     status: '$nfts.status'
      //   },
      // },
    ];
    const [result, summary] = await Promise.all([
      Utils.aggregatePaginate(this.ownerModel, pipeline, {
        sort: {
          lastDateBought: 'desc',
        },
      }),
      this.ownerModel.aggregate(pipeline),
    ]);
    // if (summary?.length > 0) {
    //   const totalOwnerItem = summary.reduce((accumulator, currentValue) => {
    //     return accumulator + currentValue.totalItem;
    //   }, 0);
    //   result.totalOwnerItem = totalOwnerItem;
    // }
    return result;
  }

  async create(requestData: CreateNftDto, address: string) {
    const { name, description, attributes, ipfsUrl } = requestData;
    // Validate
    const nftCode = await this.commonService.findNextIndex(CounterName.NFT);
    const nftSlug = slugify(`${requestData.name}-${nftCode}`, { lower: true });
    const metadata = {
      name,
      description,
      image: ipfsUrl,
      attributes,
    };
    const { link } = await this.uploadMetadataToIpfs(metadata);

    // const session = await this.connection.startSession();
    let createdNft = null;
    // await session.withTransaction(async () => {
    console.log('============');
    createdNft = new this.nftModel(requestData);
    createdNft.slug = nftSlug;
    createdNft.status = NFTStatus.UNMINT;
    createdNft.ipfsImage = ipfsUrl;
    createdNft.name = name;
    createdNft.description = description;
    createdNft.ipfsMetadata = link;
    createdNft.creatorAddress = address;

    await createdNft.save();
    const dataUpdateOwner = {
      nft: createdNft,
      address,
    };
    await this.commonService.updateOwnerAfterCreateNft(dataUpdateOwner);
    // })
    // await session.endSession();
    return createdNft;
  }

  async uploadsFileToIpfs(content: Express.Multer.File) {
    const ipfsGateway = new IpfsGateway(IpfsClientType.INFURA);
    console.log('ipfsGateway :>> ', ipfsGateway);
    const data = await ipfsGateway.upload(content);
    return {
      image: data,
    };
  }

  async uploadMetadataToIpfs(data: any) {
    const ipfsGateway = new IpfsGateway(IpfsClientType.INFURA);
    console.log('ipfsGateway :>> ', ipfsGateway);
    const link = await ipfsGateway.uploadMetadataToIpfs(data);
    console.log('link :>> ', link);
    return {
      link,
    };
  }

  async mintNft(
    id: string,
    { totalSupply, hash }: MintNftDto,
    address: string,
  ) {
    const data = {
      nftId: id,
      address,
      hash,
      totalSupply,
    };
    return Promise.all([
      this.nftModel.findByIdAndUpdate(
        { _id: id },
        {
          'token.totalSupply': totalSupply,
          'token.ids': id,
          status: NFTStatus.MINTED,
          code: id,
        },
        {
          new: true,
        },
      ),
      this.commonService.updateOwnerAfterMint(data),
    ]);
  }

  async putOnSale({ price, hashPutOnSale }, address, id) {
    // Call to contract get orderId base on hash
    const provider = this.commonService.getProvider(process.env.CHAIN_ID);
    while(true) {
      const dataPutOneSale = await provider.getTransactionReceipt(hashPutOnSale);
      if(dataPutOneSale?.logs[1]) {
        const orderId = dataPutOneSale.logs[1].topics[1];
        return this.nftModel.updateOne(
          { _id: Utils.toObjectId(id) },
          {
            $set: {
              price: price,
              hashPutOnSale: hashPutOnSale,
              status: NFTStatus.ON_SALE,
              orderId: orderId,
            },
          },
          {
            new: true
          }
        );
      }
      
    }
    
  }

  async cancelOnSale({ hashPutOnSale }, address, id) {
    const provider = this.commonService.getProvider(process.env.CHAIN_ID);
    while(true) {
      const dataPutOneSale = await provider.getTransactionReceipt(hashPutOnSale);
      if(dataPutOneSale?.logs[1]) {
        return this.nftModel.updateOne(
          { _id: Utils.toObjectId(id) },
          {
            $set: {
              hashPutOnSale: hashPutOnSale,
              status: NFTStatus.OFF_SALE,
              orderId: '',
            },
          },
          {
            new: true
          }
        );
      }
      
    }
  }
}

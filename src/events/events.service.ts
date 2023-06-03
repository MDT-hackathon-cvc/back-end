import { USDT } from './../common/constants';
import { CommonService } from 'src/common-service/common.service';
import { ErrorCode } from 'src/common/constants';
import { EventStatus, EventType } from './../schemas/Event.schema';
import { NFT, NFTDocument } from 'src/schemas/NFT.schema';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { Event, EventDocument } from 'src/schemas/Event.schema';
import { FindEventDto } from './dto/user/find-event';
import { Utils } from 'src/common/utils';
import { UserJWT } from 'src/auth/role.enum';
import { ApiError } from 'src/common/api';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectModel(NFT.name) private nftModel: Model<NFTDocument>,
    private commonService: CommonService,
  ) {}

  async findAll(requestData: FindEventDto, user: UserJWT) {
    const condition = this.getConditionFindEvent(requestData, user);
    const pipe = [
      {
        $match: {
          $and: condition,
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
          totalNftCategories: {
            $size: '$categories.totalMinted',
          },
        },
      },
    ];
    requestData.sort = {
      status: 'esc',
      endDate: 'esc',
    };
    const result = await Utils.aggregatePaginate(
      this.eventModel,
      pipe,
      requestData,
    );
    return result;
  }

  getConditionFindEvent(requestData: FindEventDto, user: UserJWT) {
    const { keyword, status, type, nftIds, isValidEvent } = requestData;
    const { startDate, endDate } = requestData;
    const condition: mongoose.FilterQuery<EventDocument>[] = [
      {
        isDeleted: false,
        $or: [
          {
            isPrivate: false,
          },
          {
            isPrivate: true,
            type: EventType.WHITE_LIST,
            'whitelistInfo.address': {
              $elemMatch: {
                $eq: user?.address,
              },
            },
          },
        ],
      },
    ];
    if (keyword) {
      condition.push({ name: { $regex: keyword, $options: 'i' } });
    }
    if (status) {
      condition.push({
        status: {
          $in: status,
        },
      });
    } else {
      condition.push({
        status: {
          $in: [EventStatus.LIVE, EventStatus.COMING_SOON, EventStatus.END],
        },
      });
    }
    if (isValidEvent) {
      condition.push({
        $or: [
          {
            status: {
              $in: [EventStatus.COMING_SOON, EventStatus.LIVE],
            },
            type: EventType.PUBLIC,
          },
          {
            status: {
              $in: [EventStatus.COMING_SOON, EventStatus.LIVE],
            },
            type: EventType.WHITE_LIST,
            'whitelistInfo.address': {
              $elemMatch: {
                $eq: user?.address,
              },
            },
          },
        ],
      });
    }
    if (type) {
      condition.push({
        type: {
          $in: type,
        },
      });
    }
    if (nftIds) {
      condition.push({
        'categories.nftId': {
          $in: nftIds,
        },
      });
    }
    if (startDate) {
      condition.push({
        $or: [
          {
            startDate: {
              $lte: new Date(startDate),
            },
            endDate: {
              $gte: new Date(startDate),
            },
          },
          {
            startDate: {
              $gte: new Date(startDate),
            },
          },
        ],
      });
    }
    if (endDate) {
      condition.push({
        $or: [
          {
            startDate: {
              $lte: new Date(endDate),
            },
            endDate: {
              $gte: new Date(endDate),
            },
          },
          {
            endDate: {
              $lte: new Date(endDate),
            },
          },
        ],
      });
    }
    return condition;
  }

  async findOne(id: string, user: UserJWT) {
    const currencies = await this.commonService.findCurrencies();
    const pipeline = [
      {
        $match: {
          _id: id,
        },
      },
      {
        $unwind: {
          path: '$categories',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $set: {
          'categories.currency': {
            $first: {
              $filter: {
                input: currencies,
                as: 'currency',
                cond: {
                  $eq: [
                    '$$currency.name',
                    { $ifNull: ['$categories.currency', USDT] },
                  ],
                },
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: 'nfts',
          localField: 'categories.nftId',
          foreignField: '_id',
          as: 'nft',
        },
      },
      { $unwind: '$nft' },
      {
        $addFields: {
          'categories.unitPriceUsd': {
            $multiply: ['$categories.unitPrice', '$categories.currency.usd'],
          },
          'categories.totalSupply': '$nft.token.totalSupply',
          'categories.description': '$nft.description',
        },
      },
      {
        $unset: 'categories.currency',
      },
      {
        $group: {
          _id: {
            id: '$_id',
            name: '$name',
            status: '$status',
            description: '$description',
            limitPerTransaction: '$limitPerTransaction',
            type: '$type',
            startDate: '$startDate',
            endDate: '$endDate',
            whitelistInfo: '$whitelistInfo',
            imgUrl: '$imgUrl',
            signature: '$signature',
            isPrivate: '$isPrivate',
          },
          categories: { $push: '$categories' },
          floorPrice: { $min: '$categories.unitPrice' },
          floorPriceUsd: { $min: '$categories.unitPriceUsd' },
        },
      },
      {
        $project: {
          _id: '$_id.id',
          name: '$_id.name',
          status: '$_id.status',
          description: '$_id.description',
          limitPerTransaction: '$_id.limitPerTransaction',
          type: '$_id.type',
          startDate: '$_id.startDate',
          endDate: '$_id.endDate',
          whitelistInfo: '$_id.whitelistInfo',
          imgUrl: '$_id.imgUrl',
          signature: '$_id.signature',
          isPrivate: '$_id.isPrivate',
          categories: '$categories',
          floorPrice: '$floorPrice',
          floorPriceUsd: '$floorPriceUsd',
          isInWhiteList: {
            $filter: {
              input: '$_id.whitelistInfo.address',
              as: 'address',
              cond: {
                $eq: ['$$address', user?.address],
              },
            },
          },
        },
      },
    ];

    const result = await this.eventModel.aggregate(pipeline);
    return result ? result[0] : null;
  }
}

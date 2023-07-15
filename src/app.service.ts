import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { CommonService } from './common-service/common.service';
import { Model } from 'mongoose';
import { Config, ConfigDocument, Signer } from './schemas/Config.schema';
import { QUEUE } from './common/constants';
import mongoose from 'mongoose';
import {
  Event,
  EventDocument,
  EventStatus,
  EventType,
} from './schemas/Event.schema';
import { TransactionsService } from './transactions/transactions.service';

@Injectable()
export class AppService {
  constructor(
    private commonService: CommonService,
    private transactionService: TransactionsService,
    @InjectConnection() private readonly connection: mongoose.Connection,
    @InjectModel(Config.name) private configModel: Model<ConfigDocument>,
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
  ) {}

  getHello() {
    return 'Ekoios';
  }

  getConfig(address: string) {
    return this.commonService.findConfig(address);
  }

  getFullConfig() {
    return this.commonService.findFullConfig();
  }

  async updateConfig(requestData: any) {
    await this.commonService.clearCacheConfig();

    let currentConfig = await this.configModel.findOne();
    if (currentConfig) {
      currentConfig.set(requestData);
    } else {
      currentConfig = new this.configModel(requestData);
    }
    return currentConfig.save();
  }

  clearCache() {
    return this.commonService.clearCache();
  }

  checkKyc(data: any) {
    console.log(data);
  }

  async getOverview(user: any) {
    const { totalNft, sumVolume, totalMinters } =
      await this.transactionService.overview();
    let pipe;

    if (user) {
      pipe = [
        {
          $match: {
            $and: [
              {
                status: { $in: [EventStatus.LIVE, EventStatus.COMING_SOON] },
                isDeleted: false,
              },
              {
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
            ],
          },
        },
        {
          $sort: {
            status: 1,
            name: 1,
            startDate: 1,
            endDate: 1,
          },
        },
        { $limit: 2 },
      ];
    } else {
      pipe = [
        {
          $match: {
            status: { $in: [EventStatus.LIVE, EventStatus.COMING_SOON] },
          },
        },
        {
          $sort: {
            status: 1,
            name: 1,
            startDate: 1,
            endDate: 1,
          },
        },
        { $limit: 2 },
      ];
    }
    const events = await this.eventModel.aggregate(pipe);
    return {
      itemsSold: totalNft,
      totalVolume: sumVolume,
      totalMinters,
      events,
    };
  }

  async getPermissionAdmin(address: string) {
    return this.commonService.getPermissionsOfAdmin(address);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { CommonService } from './common-service/common.service';
import { Model } from 'mongoose';
import { Config, ConfigDocument, Signer } from './schemas/Config.schema';
import { QUEUE } from './common/constants';
import mongoose from 'mongoose';

import { TransactionsService } from './transactions/transactions.service';

@Injectable()
export class AppService {
  constructor(
    private commonService: CommonService,
    private transactionService: TransactionsService,
    @InjectConnection() private readonly connection: mongoose.Connection,
    @InjectModel(Config.name) private configModel: Model<ConfigDocument>,
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


  async getPermissionAdmin(address: string) {
    return this.commonService.getPermissionsOfAdmin(address);
  }
}

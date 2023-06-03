import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { Model } from 'mongoose';
import { CommonService } from 'src/common-service/common.service';
import { ApiError } from 'src/common/api';
import { ErrorCode } from 'src/common/constants';
import { NFT, NFTDocument } from 'src/schemas/NFT.schema';

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);

  constructor(
    @InjectConnection() private readonly connection: mongoose.Connection,
    @InjectModel(NFT.name)
    private nftModel: Model<NFTDocument>,
    private commonService: CommonService,
  ) {}

  async findBy721ByNftId(id: string) {
    const nft = await this.commonService.findNFTByIdV2(id);
    const metaData = this.commonService.getMetaData(nft);
    return metaData;
  }

}

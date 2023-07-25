import { NotificationType } from 'src/schemas/Notification.schema';
import { LockType } from 'src/schemas/Lock.schema';
import { ErrorMessage } from '../common/constants';
import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import {
  CategoryInEvent,
  Event,
  EventDocument,
} from 'src/schemas/Event.schema';
import { CreateEventDto } from './dto/admin/create-event.dto';
import { UpdateEventDto } from './dto/admin/update-event.dto';
import { ErrorCode } from 'src/common/constants';
import { ApiError } from 'src/common/api';
import { Web3Gateway } from 'src/blockchain/web3.gateway';
import { CommonService } from 'src/common-service/common.service';
import { Utils } from 'src/common/utils';
import { FindEventDto } from './dto/admin/find-event';
import { NFT, NFTDocument, NFTStatus } from 'src/schemas/NFT.schema';
import { EventStatus, EventType } from '../schemas/Event.schema';
import { AwsUtils } from 'src/common/aws.util';
import { Web3ETH } from 'src/blockchain/web3.eth';
import { GetMintedTokenByEventId } from './dto/admin/get-minted-token-by-event-id';
import { Owner, OwnerDocument } from 'src/schemas/Owner.schema';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  constructor(
    @InjectConnection() private readonly connection: mongoose.Connection,
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectModel(NFT.name) private nftModel: Model<NFTDocument>,
    @InjectModel(Owner.name) private ownerModel: Model<OwnerDocument>,
    private commonService: CommonService,
  ) {}
  async create(createEventDto: CreateEventDto) {
    const { name, startDate, image, whitelist, type, isDraft, whitelistJson } =
      createEventDto;
    // Check categories valid
    const { newCategories, categoriesSaveDB } =
      await this.validateAndGetNewCategories(createEventDto);
    createEventDto.categories = categoriesSaveDB;

    let result;
    const createdEvent = new this.eventModel(createEventDto);
    createdEvent['endTimeOrigin'] = createEventDto.endDate;
    // upload image to S3
    const promise = [
      AwsUtils.uploadS3(image.buffer, image.mimetype, this.getEventPath(name)),
    ];
    if (type === EventType.WHITE_LIST) {
      const listAddress = await this.validateWhitelist(whitelistJson);
      createdEvent.whitelistInfo = {
        size: whitelist.size,
        fileName: whitelist.originalname,
        address: listAddress,
        url: '',
      };
      promise.push(
        AwsUtils.uploadS3(
          whitelist.buffer,
          whitelist.mimetype,
          this.getWhitelistPath(name),
        ),
      );
    }
    const [imgUrl, whitelistUrl] = await Promise.all(promise);
    createdEvent.imgUrl = imgUrl;
    if (whitelistUrl) {
      createdEvent.whitelistInfo.url = whitelistUrl;
    }

    // update data
    const session = await this.connection.startSession();
    await session.withTransaction(async () => {
      if (isDraft) {
        createdEvent.status = EventStatus.DRAFT;
      } else {
        createdEvent.status =
          Utils.getTime(startDate) <= Utils.getTime()
            ? EventStatus.LIVE
            : EventStatus.COMING_SOON;
        // update NFT table
        await Promise.all(
          newCategories.map(async (category) => {
            const nft = await this.nftModel.findById(category.nftId);
            nft.$set(
              'token.totalAvailable',
              category.previousAvailable - category.quantityForSale,
            );
            if (nft.status === NFTStatus.OFF_SALE) {
              nft.$set('status', NFTStatus.ON_SALE);
            }
            await nft.save({ session });
          }),
        );
        const signature = await this.createEventSignature(createdEvent);
        createdEvent.signature = signature;
      }
      result = await createdEvent.save({ session });
    });
    await session.endSession();
    if (!isDraft) {
      this.commonService.pushNotificationUser(NotificationType.N8, {
        mintingEvent: createdEvent,
      });
    }
    this.checkUpdateEventStatus(createdEvent);
    return result;
  }

  async checkUpdateEventStatus(event: EventDocument) {
    const { startDate, endDate, status } = event;
    if ([EventStatus.COMING_SOON, EventStatus.LIVE].includes(status)) {
      let remainMilliseconds;
      if (status === EventStatus.COMING_SOON) {
        remainMilliseconds =
          new Date(startDate).getTime() - new Date().getTime();
      } else {
        remainMilliseconds = new Date(endDate).getTime() - new Date().getTime();
      }
      const timeOutId = setTimeout(async () => {
        await this.countdownUpdateEventStatus(event._id, timeOutId);
      }, remainMilliseconds);
    }
  }

  async countdownUpdateEventStatus(eventId: string, timeOutIdParams: any) {
    try {
      const event = await this.eventModel.findById(eventId);
      if (
        !event ||
        event?.isDeleted ||
        ![EventStatus.COMING_SOON, EventStatus.LIVE].includes(event?.status)
      ) {
        return;
      }
      // start update
      const { startDate, endDate } = event;
      const session = await this.connection.startSession();
      await session.withTransaction(async () => {
        if (
          event.status === EventStatus.COMING_SOON &&
          Utils.getTime(startDate) <= Utils.getTime()
        ) {
          this.logger.log(
            `COMING SOON -> LIVE, EventName: ${event.name}, EventId: ${event._id}`,
          );
          event.status = EventStatus.LIVE;
          await event.save({ session });
          // countdown to update COMING_SOON -> LIVe
          clearTimeout(timeOutIdParams);
          const remainEndMilliseconds =
            new Date(endDate).getTime() - new Date().getTime();
          const timeOutId = setTimeout(async () => {
            await this.countdownUpdateEventStatus(event._id, timeOutId);
          }, remainEndMilliseconds);
          // push noti
          await Promise.all([
            this.commonService.pushNotificationUser(NotificationType.N9, {
              mintingEvent: event,
            }),
            this.commonService.pushNotificationAdmin(NotificationType.P4, {
              mintingEvent: event,
            }),
          ]);
        } else if (
          event.status === EventStatus.LIVE &&
          Utils.getTime(event.endDate) <= Utils.getTime()
        ) {
          this.logger.log(
            `LIVE -> END, EventName: ${event.name}, EventId: ${event._id}`,
          );
          event.status = EventStatus.END;
          await event.save({ session });
          // update Total Available in NFT table
          for (const category of event.categories) {
            const { nftId, totalMinted, quantityForSale } = category;
            const nft = await this.nftModel.findById(nftId);
            nft.$set(
              'token.totalAvailable',
              nft.token.totalAvailable + quantityForSale - totalMinted,
            );
            const onSaleQuantity =
              nft.token.totalSupply -
              nft.token.totalAvailable -
              nft.token.totalMinted;
            if (onSaleQuantity === 0) {
              nft.status = NFTStatus.OFF_SALE;
            }
            await nft.save({ session });
          }
          clearTimeout(timeOutIdParams);
          // push noti
          await this.commonService.pushNotificationAdmin(NotificationType.P5, {
            mintingEvent: event,
          });
        }
      });
      await session.endSession();
    } catch (err) {
      this.logger.error(
        `countdownUpdateEventStatus() with eventId ${eventId}, detail error`,
        err,
      );
      await Utils.wait(5000);
      this.countdownUpdateEventStatus(eventId, timeOutIdParams);
    }
  }

  async createEventSignature(event: EventDocument) {
    const { startDate, endDate, creatorAddress, _id } = event;
    const web3Gateway = new Web3Gateway();
    const dataToSign = [
      Utils.convertDateToSeconds(startDate),
      Utils.convertDateToSeconds(endDate),
      creatorAddress,
      Utils.formatMongoId(_id),
    ];
    const signer = await this.commonService.findSigner();
    const signature = await web3Gateway.sign(dataToSign, signer.privateKey);
    return {
      address: signer.address,
      hash: signature,
      data: dataToSign,
    };
  }

  async validateAndGetNewCategories(
    requestData: CreateEventDto | UpdateEventDto,
    isUpdate = false,
  ) {
    const { startDate, endDate, categories, image, whitelist, type } =
      requestData;
    if (
      (!isUpdate && !image) ||
      Utils.getTime(startDate) > Utils.getTime(endDate) ||
      (!isUpdate && type === EventType.WHITE_LIST && !whitelist)
    ) {
      throw ApiError(ErrorCode.INVALID_DATA, ErrorMessage.INVALID_DATA);
    }
    const newCategories = await Promise.all(
      categories.map(async (category, index) => {
        const nft = await this.nftModel.findById(category?.nftId);
        await this.validateNftInCategory(nft, category);
        return {
          ...category,
          nftId: Utils.toObjectId(category.nftId),
          quantityForSale: Number(category.quantityForSale),
          unitPrice: Number(category.unitPrice),
          previousAvailable: nft.token.totalAvailable,
          totalMinted: 0,
          name: nft.name,
          image: nft.image.url,
        };
      }),
    );
    const categoriesSaveDB = newCategories.map((category) => {
      const { previousAvailable, ...newPayload } = category;
      return newPayload;
    });
    return { newCategories, categoriesSaveDB };
  }

  getEventPath(eventName: string) {
    return `events/${eventName}-${new Date().getTime()}`;
  }

  getWhitelistPath(eventName: string) {
    return `whitelist/${eventName}-${new Date().getTime()}`;
  }

  async validateWhitelist(whitelistJson: string) {
    let listAddress = JSON.parse(whitelistJson);
    const web3ETH = new Web3ETH();
    listAddress = listAddress.map((address) => {
      if (address && !web3ETH.checkAddress(address)) {
        throw ApiError(ErrorCode.INVALID_DATA, 'Address invalid');
      }
      return web3ETH.toChecksumAddress(address);
    });
    return listAddress;
  }

  async findAll(requestData: FindEventDto) {
    const condition = this.getConditionFindEvent(requestData);
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
    const result = await Utils.aggregatePaginate(
      this.eventModel,
      pipe,
      requestData,
    );
    return result;
  }

  getConditionFindEvent(requestData: FindEventDto) {
    const { keyword, status, type, nftIds, startCreatedDate, endCreatedDate } =
      requestData;
    const { startPeriodDate, endPeriodDate } = requestData;
    const condition: mongoose.FilterQuery<EventDocument>[] = [
      { isDeleted: false },
    ];
    if (keyword) {
      condition.push({ name: { $regex: keyword, $options: 'i' } });
    }
    if (status) {
      condition.push({ status });
    }
    if (type) {
      condition.push({ type });
    }
    if (nftIds) {
      condition.push({
        'categories.nftId': {
          $in: nftIds,
        },
      });
    }
    if (startCreatedDate) {
      condition.push({
        createdAt: {
          $gte: new Date(startCreatedDate),
        },
      });
    }
    if (endCreatedDate) {
      condition.push({
        createdAt: {
          $lte: new Date(endCreatedDate),
        },
      });
    }
    if (startPeriodDate) {
      condition.push({
        $or: [
          {
            startDate: {
              $lte: new Date(startPeriodDate),
            },
            endDate: {
              $gte: new Date(startPeriodDate),
            },
          },
          {
            startDate: {
              $gte: new Date(startPeriodDate),
            },
          },
        ],
      });
    }
    if (endPeriodDate) {
      condition.push({
        $or: [
          {
            startDate: {
              $lte: new Date(endPeriodDate),
            },
            endDate: {
              $gte: new Date(endPeriodDate),
            },
          },
          {
            endDate: {
              $lte: new Date(endPeriodDate),
            },
          },
        ],
      });
    }
    return condition;
  }

  async findOne(id: string) {
    const event = await this.eventModel.findById(id);
    let totalQuantityForSale = 0;
    let totalMinted = 0;
    if (event?.categories) {
      event.categories.map((category) => {
        totalQuantityForSale += category.quantityForSale;
        totalMinted += category.totalMinted;
      });
    }
    return { ...event.toObject(), totalQuantityForSale, totalMinted };
  }

  async update(id: string, requestData: UpdateEventDto) {
    return this.commonService.withLock(
      { type: LockType.UPDATE_REDEMPTION, documentId: id },
      async () => {
        const {
          name,
          startDate,
          image,
          whitelist,
          type,
          isDraft,
          whitelistJson,
        } = requestData;
        const event = await this.eventModel.findById(id);
        if (event.status !== EventStatus.DRAFT || event.isDeleted) {
          throw ApiError(ErrorCode.INVALID_DATA, 'Event cannot update', event);
        }
        // Check categories valid
        const { newCategories, categoriesSaveDB } =
          await this.validateAndGetNewCategories(requestData, true);
        requestData.categories = categoriesSaveDB;
        event.set(requestData);

        // upload image to S3
        if (image) {
          const imgUrl = await AwsUtils.uploadS3(
            image.buffer,
            image.mimetype,
            this.getEventPath(name),
          );
          event.imgUrl = imgUrl;
        }
        if (type === EventType.WHITE_LIST && whitelist) {
          const listAddress = await this.validateWhitelist(whitelistJson);
          event.whitelistInfo = {
            size: whitelist.size,
            fileName: whitelist.originalname,
            address: listAddress,
            url: '',
          };
          const whitelistUrl = await AwsUtils.uploadS3(
            whitelist.buffer,
            whitelist.mimetype,
            this.getWhitelistPath(name),
          );
          event.whitelistInfo.url = whitelistUrl;
        } else if (type === EventType.PUBLIC) {
          event.whitelistInfo = null;
        }

        // update data
        const session = await this.connection.startSession();
        await session.withTransaction(async () => {
          if (isDraft) {
            event.status = EventStatus.DRAFT;
          } else {
            event.status =
              Utils.getTime(startDate) <= Utils.getTime()
                ? EventStatus.LIVE
                : EventStatus.COMING_SOON;
            // update NFT table
            await Promise.all(
              newCategories.map(async (category) => {
                const nft = await this.nftModel.findById(category.nftId);
                nft.$set(
                  'token.totalAvailable',
                  category.previousAvailable - category.quantityForSale,
                );
                if (nft.status === NFTStatus.OFF_SALE) {
                  nft.$set('status', NFTStatus.ON_SALE);
                }
                await nft.save({ session });
              }),
            );
            const signature = await this.createEventSignature(event);
            event.signature = signature;
          }
          await event.save({ session });
        });
        await session.endSession();
        // push noti
        if (!isDraft) {
          this.commonService.pushNotificationUser(NotificationType.N8, {
            mintingEvent: event,
          });
        }
        this.checkUpdateEventStatus(event);
        return event;
      },
    );
  }

  async launch(id: string) {
    return this.commonService.withLock(
      { type: LockType.UPDATE_REDEMPTION, documentId: id },
      async () => {
        const event = await this.eventModel.findById(id);
        if (!event) {
          throw ApiError(ErrorCode.LAUNCH_EVENT_ERR, 'Cannot found Event');
        }
        const { startDate, endDate, status, isDeleted } = event;
        if (
          isDeleted ||
          status !== EventStatus.DRAFT ||
          Utils.getTime(endDate) < Utils.getTime()
        ) {
          throw ApiError(ErrorCode.LAUNCH_EVENT_ERR, 'Event cannot launch');
        }

        // update data
        const session = await this.connection.startSession();
        await session.withTransaction(async () => {
          await Promise.all(
            event.categories.map(async (category) => {
              const nft = await this.nftModel.findById(category?.nftId);
              await this.validateNftInCategory(nft, category);
              nft.$set(
                'token.totalAvailable',
                nft.token.totalAvailable - category.quantityForSale,
              );
              if (nft.status === NFTStatus.OFF_SALE) {
                nft.$set('status', NFTStatus.ON_SALE);
              }
              await nft.save({ session });
            }),
          );
          event.status =
            Utils.getTime(startDate) <= Utils.getTime()
              ? EventStatus.LIVE
              : EventStatus.COMING_SOON;
          const signature = await this.createEventSignature(event);
          event.signature = signature;
          await event.save({ session });
        });
        await session.endSession();
        this.commonService.pushNotificationUser(NotificationType.N8, {
          mintingEvent: event,
        });
        this.checkUpdateEventStatus(event);
        return event;
      },
    );
  }

  async validateNftInCategory(
    nft: NFTDocument,
    category: CategoryInEvent | any,
  ) {
    if (!nft) {
      throw ApiError(ErrorCode.INVALID_DATA, 'NFT Category invalid');
    }
    if (nft.token.totalAvailable < category.quantityForSale) {
      throw ApiError(
        ErrorCode.INSUFFICIENT_QUANTITY_NFT,
        `Insufficient quantity Nft`,
      );
    }
  }

  async remove(id: string) {
    const event = await this.eventModel.findById(id);
    if (!event) {
      throw ApiError(ErrorCode.INVALID_DATA, 'Cannot found Event');
    }
    if (event.status !== EventStatus.DRAFT || event.isDeleted) {
      throw ApiError(ErrorCode.INVALID_DATA, 'Event cannot delete');
    }
    event.isDeleted = true;
    await event.save();
    return event;
  }

  async getMintedTokenByEventId(
    eventId: string,
    requestData: GetMintedTokenByEventId,
  ) {
    const { nftIds, keyword, startDate, endDate } = requestData;
    const condition = [{}];
    if (keyword) {
      condition.push({
        $or: [
          {
            mintedAddress: new Web3ETH().toChecksumAddress(keyword),
          },
          {
            tokenId: keyword,
          },
        ],
      });
    }
    if (nftIds) {
      condition.push({
        nftId: {
          $in: nftIds,
        },
      });
    }
    if (startDate) {
      condition.push({
        mintedDate: {
          $gte: new Date(startDate),
        },
      });
    }
    if (endDate) {
      condition.push({
        mintedDate: {
          $lte: new Date(endDate),
        },
      });
    }
    const pipeline = [
      {
        $match: {
          'event.id': eventId,
        },
      },
      {
        $match: {
          $and: condition,
        },
      },
      {
        $project: {
          _id: '$nftId',
          name: '$nft.name',
          image: '$nft.image',
          owners: {
            tokenId: '$tokenId',
            mintedAddress: '$mintedAddress',
            event: '$event',
            mintedDate: '$mintedDate',
            mintedHash: '$mintedHash',
            mintedValue: '$mintedValue',
            status: '$status',
          },
        },
      },
    ];
    const result = await Utils.aggregatePaginate(
      this.ownerModel,
      pipeline,
      requestData,
    );
    return result;
  }

  async resetTimeoutEvent() {
    const events = await this.eventModel.find({
      isDeleted: false,
      status: { $in: [EventStatus.COMING_SOON, EventStatus.LIVE] },
    });
    for (const event of events) {
      await this.checkUpdateEventStatus(event);
    }
  }
}

import { NotificationType } from 'src/schemas/Notification.schema';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import BigNumber from 'bignumber.js';
import mongoose, { Model } from 'mongoose';
import { CommonService } from 'src/common-service/common.service';
import { ApiError } from 'src/common/api';
import { ErrorCode, HUNDRED } from 'src/common/constants';
import { Utils } from 'src/common/utils';
import { FindOwnerDto } from 'src/nfts/dto/admin/find-owner.dto';
import { NFT, NFTDocument, OwnerStatus } from 'src/schemas/NFT.schema';
import {
  Transaction,
  TransactionDocument,
  TransactionStatus,
  TransactionType,
} from 'src/schemas/Transaction.schema';
import {
  AdminActions,
  AdminPermissions,
  KYCStatus,
  SUPER_ADMIN_NAME,
  User,
  UserDocument,
  UserRole,
  UserStatus,
  UserType,
} from 'src/schemas/User.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { FindCommisionDto } from './dto/find-commision.dto';
import { ExportType, SearchUserDto } from './dto/search-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { EventKYC, StatusKyc } from 'src/users/dto/kyc-user.dto';
import { Owner, OwnerDocument } from 'src/schemas/Owner.schema';
import { SearchAdminDto } from './dto/search-admin.dto';
@Injectable()
export class UsersService {
  constructor(
    @InjectConnection() private readonly connection: mongoose.Connection,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(NFT.name) private nftModel: Model<NFTDocument>,
    @InjectModel(Transaction.name)
    private transactionModel: Model<TransactionDocument>,
    @InjectModel(Owner.name)
    private ownerModel: Model<OwnerDocument>,
    private commonService: CommonService,
  ) {}

  async update(address: string, updateUserDto: UpdateUserDto) {
    const userDto: any = {};
    const user = await this.findByAddress(address);
    if (user) {
      throw ApiError(ErrorCode.INVALID_DATA, 'The user have existed in system');
    }

    let referrerInfo: any;
    if (updateUserDto?.referrer) {
      referrerInfo = await this.findUserByAddressOrId({
        addr: updateUserDto.referrer,
      });
      if (referrerInfo.role === UserRole.ADMIN) {
        throw ApiError(
          ErrorCode.INVALID_DATA,
          'The referrer must be different to admin',
        );
      }

      if (referrerInfo.kycInfo.kycStatus === KYCStatus.VERIFIED) {
        throw ApiError(
          ErrorCode.INVALID_DATA,
          'The referrer must be verify kyc',
        );
      }
    } else {
      referrerInfo = await this.userModel.findOne({
        role: UserRole.SYSTEM,
      });
    }

    userDto.address = address;
    userDto.referrer = referrerInfo.address;
    userDto.originator = referrerInfo.originator || referrerInfo.address;
    userDto.pathId = [...referrerInfo.pathId, referrerInfo.address];

    return this.userModel.insertMany(userDto);
  }

  async findAll(requestData: SearchUserDto) {
    const conditionAnd: mongoose.FilterQuery<UserDocument>[] = [
      { isDeleted: false, role: { $in: [UserRole.USER, UserRole.SYSTEM] } },
    ];
    // Search userName, referee, leader address
    if (requestData?.keyword) {
      const conditionOr = [
        { referrer: Utils.formatAddress(requestData.keyword.trim()) },
        { originator: Utils.formatAddress(requestData.keyword.trim()) },
        { address: Utils.formatAddress(requestData.keyword.trim()) },
      ];
      conditionAnd.push({ $or: conditionOr });
    }

    // Search user by start date
    if (requestData?.startDate) {
      conditionAnd.push({
        createdAt: { $gte: new Date(requestData?.startDate) },
      });
    }

    // Search user by end date
    if (requestData?.endDate) {
      conditionAnd.push({
        createdAt: { $lte: new Date(requestData?.endDate) },
      });
    }

    // Search by kyc status
    if (requestData?.kycStatus) {
      conditionAnd.push({
        'kycInfo.kycStatus': requestData.kycStatus,
      });
    }

    // Search by user type
    if (requestData?.userType) {
      conditionAnd.push({
        userType: requestData.userType,
      });
    }

    // Search by equity share
    if (requestData?.equityShare) {
      conditionAnd.push({ equityShare: { $gt: 0 } });
    }

    const pipe: mongoose.PipelineStage[] = [{ $match: { $and: conditionAnd } }];

    const result = await Utils.aggregatePaginate(
      this.userModel,
      pipe,
      requestData,
    );

    result.docs = await this.getChildrenAndMeInfo(result.docs);

    result.docs = await Promise.all(
      result.docs.map(async (item) => {
        const ownerTokens = await this.countTokenOwnerByToken(item.address);
        const stakingShares = await this.commonService.countLockingSharesByUser(
          item.address,
        );
        return { ...item, ownerTokens, stakingShares };
      }),
    );
    const totalUser = this.totalUsersInfo(result.docs);
    return { ...result, ...totalUser };
  }

  async countTokenOwnerByToken(address: string) {
    const result = await this.ownerModel.aggregate([
      {
        $match: {
          address: address,
          status: {
            $in: [
              OwnerStatus.INVALID,
              OwnerStatus.UNLOCKED,
              OwnerStatus.REDEEMED,
              OwnerStatus.LOCKED,
            ],
          },
        },
      },
    ]);
    return result.length;
  }

  async countValidTokenOwnerByAddress(address: string) {
    const result = await this.ownerModel.aggregate([
      {
        $match: {
          address: address,
          status: {
            $in: [
              OwnerStatus.UNLOCKED,
              OwnerStatus.REDEEMED,
              OwnerStatus.LOCKED,
            ],
          },
        },
      },
    ]);
    return result.length;
  }

  totalUsersInfo(users: any[]) {
    const result = users.reduce(
      ({ common, bda, stakingShares, equityShares, ownerTokens }, currItem) => {
        if (currItem?.userType === UserType.COMMON) {
          common += 1;
        } else if (currItem?.userType === UserType.BDA) {
          bda += 1;
        }
        equityShares += currItem?.equityShare || 0;
        ownerTokens += currItem?.ownerTokens || 0;
        stakingShares += stakingShares;
        return { common, bda, stakingShares, equityShares, ownerTokens };
      },
      { common: 0, bda: 0, stakingShares: 0, equityShares: 0, ownerTokens: 0 },
    );
    return result;
  }

  findByAddress(address: string) {
    return this.userModel.findOne({ address });
  }

  async findUserInfoByAddressOrId({ address, id }: any) {
    const userInfo = await this.findUserByAddressOrId({ id, addr: address });
    let info: any = {};
    if (userInfo.userType === UserType.BDA) {
      const children =
        await this.commonService.getChildrenOrDirectRefereeFromAddress(
          userInfo.address,
        );
      // add user to list child
      children.push({
        address: userInfo.address,
        referrer: userInfo.referrer,
        originator: userInfo.originator,
      });
      const groupInfo = await this.commonService.getGroupInfoByAddress(
        children,
      );

      if (groupInfo?.length > 0) {
        info = groupInfo[0];
      }
      info.totalMember = children?.length || 0;
    }
    const ownedTokens = await this.countTokenOwnerByToken(userInfo.address);
    const ownedValidTokens = await this.countValidTokenOwnerByAddress(
      userInfo.address,
    );
    const stakingShare = await this.commonService.countLockingSharesByUser(
      userInfo.address,
    );
    return {
      ...userInfo.toObject(),
      ...info,
      ownedTokens,
      ownedValidTokens,
      stakingShare,
    };
  }

  async findUserByAddressOrId({ id, addr }: any) {
    const userInfo = addr
      ? await this.findByAddress(addr)
      : await this.userModel.findById(id);
    if (!userInfo) {
      throw ApiError(ErrorCode.INVALID_DATA, 'The user has not existence');
    }
    return userInfo;
  }

  async findDirectReferee({ id, addr }: any, requestData: SearchUserDto) {
    const userInfo = await this.findUserByAddressOrId({ id, addr });
    const { address } = userInfo;

    const andCondition: mongoose.FilterQuery<UserDocument>[] = [
      {
        isDeleted: false,
        referrer: { $regex: address, $options: 'i' },
        role: UserRole.USER,
      },
    ];

    if (requestData?.keyword) {
      andCondition.push({
        address: Utils.formatAddress(requestData.keyword),
      });
    }

    if (requestData?.userType) {
      andCondition.push({
        userType: requestData?.userType,
      });
    }
    const pipe: mongoose.PipelineStage[] = [
      {
        $match: {
          $and: andCondition,
        },
      },
    ];

    const result: any = {};

    result.docs = await this.userModel.aggregate(pipe);

    result.docs = await this.getChildrenAndMeInfo(result.docs, true);

    this.getTotalUserInfo(result, requestData);

    return result;
  }

  getDataByPaging(values: any[], limit: number, page: number) {
    return values.slice(
      (page - 1) * limit,
      page * limit > 1 ? page * limit : 1,
    );
  }

  async getChildrenAndMeInfo(docs: any[], isMine = false) {
    const docsResult = await Promise.all(
      docs.map(async (item: User) => {
        let referrerInfo: any;
        const children =
          await this.commonService.getChildrenOrDirectRefereeFromAddress(
            item.address,
          );

        // add user to children list of one
        if (isMine) {
          children.push({
            address: item.address,
            referrer: item.referrer,
            originator: item.originator,
          });
        }

        // get total volume, total tokens sold and total memeber
        const groupInfo = await this.commonService.getGroupInfoByAddress(
          children,
        );

        // get referrer info
        if (item?.referrer) {
          referrerInfo = await this.userModel.findOne({
            address: item?.referrer,
          });
        }
        let info: any = {};
        if (groupInfo?.length > 0) {
          info = groupInfo[0];
        }
        return {
          ...item,
          ...info,
          totalMember: children?.length || 0,
          referrerType: referrerInfo?.userType,
        };
      }),
    );
    return docsResult;
  }

  async findLineDetail({ id, addr }: any, requestData: SearchUserDto) {
    const userInfo = await this.findUserByAddressOrId({ id, addr });
    const { address } = userInfo;

    const andCondition: mongoose.FilterQuery<UserDocument>[] = [
      {
        isDeleted: false,
        $or: [
          {
            pathId: {
              $elemMatch: { $regex: `^${address}$`, $options: 'i' },
            },
          },
          { address: { $regex: address, $options: 'i' } },
        ],
      },
    ];

    if (requestData?.keyword) {
      const orCondition: mongoose.FilterQuery<UserDocument>[] = [
        { address: { $regex: requestData?.keyword, $options: 'i' } },
        { referrer: { $regex: requestData?.keyword, $options: 'i' } },
      ];
      andCondition.push({ $or: orCondition });
    }

    if (requestData?.userType) {
      andCondition.push({
        userType: requestData?.userType,
      });
    }

    if (requestData?.startDate) {
      andCondition.push({
        createdAt: { $gte: new Date(requestData?.startDate) },
      });
    }

    if (requestData?.endDate) {
      andCondition.push({
        createdAt: { $lte: new Date(requestData?.endDate) },
      });
    }

    const pipe: mongoose.PipelineStage[] = [
      {
        $match: {
          $and: andCondition,
        },
      },
    ];

    const result = await Utils.aggregatePaginate(
      this.userModel,
      pipe,
      requestData,
    );

    // update referrer type
    result.docs = await Promise.all(
      result.docs.map(async (item) => {
        const referrerInfo = await this.findByAddress(item.referrer);
        return { ...item, referrerType: referrerInfo.userType };
      }),
    );

    return result;
  }

  async overviewLineDetail({ id, addr }: any) {
    const userInfo = await this.findUserByAddressOrId({ id, addr });
    const { address } = userInfo;
    const result: any = {};
    const childrenInfo = await this.userModel.aggregate([
      {
        $match: {
          $and: [
            {
              isDeleted: false,
              $or: [
                {
                  pathId: {
                    $elemMatch: { $regex: address, $options: 'i' },
                  },
                },
                { address: { $regex: address, $options: 'i' } },
              ],
            },
          ],
        },
      },
    ]);

    const { totalTokenSold, totalVolume, totalMembers } = childrenInfo.reduce(
      ({ totalTokenSold, totalVolume, totalMembers }: any, currItem: any) => {
        totalTokenSold += currItem?.personalTokenSold || 0;
        totalVolume = new BigNumber(
          currItem?.oldPersonalVolume?.toString() || 0,
        )
          .plus(totalVolume)
          .toString();
        totalMembers += currItem?.totalMember || 0;
        return { totalTokenSold, totalVolume, totalMembers };
      },
      { totalTokenSold: 0, totalVolume: 0, totalMembers: 0 },
    );

    result.totalTokenSold = totalTokenSold || 0;
    result.totalVolume = new BigNumber(totalVolume).isNaN() ? 0 : totalVolume;
    result.totalLines = childrenInfo?.length || 0;
    result.totalMembers = childrenInfo?.length || 0;
    // update direct referree
    result.directReferree = userInfo.address;
    result.directReferreeType = userInfo.userType;
    return result;
  }

  getTotalUserInfo(result: any, requestData: any) {
    const { totalTokenSold, totalVolume, totalMembers } = result.docs.reduce(
      ({ totalTokenSold, totalVolume, totalMembers }: any, currItem: any) => {
        totalTokenSold += currItem?.totalTokenSold || 0;
        totalVolume = new BigNumber(currItem?.totalVolume || 0)
          .plus(totalVolume)
          .toString();
        totalMembers += currItem?.totalMember || 0;
        return { totalTokenSold, totalVolume, totalMembers };
      },
      { totalTokenSold: 0, totalVolume: 0, totalMembers: 0 },
    );
    // sort data
    if (requestData) {
      this.commonService.sortArrayOfObject(result.docs, requestData);
    }

    result.totalDocs = result?.docs?.length || 0;
    result.limit = requestData?.limit || 10;
    result.page = requestData?.page || 1;
    result.totalLines = result?.docs?.length || 0;

    const totalPages = Math.ceil(
      result?.docs?.length / (requestData?.limit || 10),
    );
    this.updateInfoPage(
      result,
      requestData?.page,
      1,
      totalPages,
      requestData?.limit,
    );
    // paging data
    if (requestData?.limit && requestData?.page) {
      result.docs = this.getDataByPaging(
        result.docs,
        requestData.limit,
        requestData.page,
      );
    }

    result.totalTokenSold = totalTokenSold;
    result.totalVolume = new BigNumber(totalVolume).isNaN() ? 0 : totalVolume;
    result.totalMembers = totalMembers;

    return result;
  }

  updateInfoPage(
    result: any,
    currPage = 1,
    startPage: number,
    endPage: number,
    limit = 10,
  ) {
    result.pagingCounter =
      (currPage - 1) * limit > 0 ? (currPage - 1) * limit : 1;
    result.hasPrevPage = currPage > startPage;
    result.hasNextPage = currPage < endPage;
    result.totalPages = endPage;
    result.nextPage = Math.min(currPage + 1, endPage);
    result.prevPage = Math.max(currPage - 1, startPage);
    return result;
  }

  async findOwnedToken({ id, addr }: any, requestData: FindOwnerDto) {
    const { keyword, startDate, endDate, nftIds, status } = requestData;
    const userInfo = await this.findUserByAddressOrId({ id, addr });
    const andCondition: mongoose.FilterQuery<NFTDocument>[] = [
      { address: { $regex: userInfo.address, $options: 'i' } },
      { status: { $ne: OwnerStatus.BURNED } },
    ];
    if (keyword) {
      const orCondition = {
        $or: [
          {
            'event.name': {
              $regex: keyword,
              $options: 'i',
            },
          },
          {
            tokenId: keyword,
          },
        ],
      };
      andCondition.push(orCondition);
    }

    if (startDate) {
      andCondition.push({
        mintedDate: { $gte: new Date(startDate) },
      });
    }

    if (endDate) {
      andCondition.push({
        mintedDate: { $lte: new Date(endDate) },
      });
    }

    if (status) {
      andCondition.push({
        status,
      });
    }

    if (nftIds) {
      andCondition.push({
        nftId: { $in: nftIds },
      });
    }

    const pipe: mongoose.PipelineStage[] = [
      {
        $match: { $and: andCondition },
      },
      {
        $addFields: {
          lockingBalance: {
            $cond: [
              { $eq: ['$status', OwnerStatus.UNLOCKED] },
              '$lockingBalance',
              {
                $add: [
                  { $subtract: ['$$NOW', '$lastLockDate'] },
                  '$lockingBalance',
                ],
              },
            ],
          },
        },
      },
      {
        $project: {
          mintedDate: 1,
          nftCategory: '$nft.name',
          tokenId: 1,
          event: 1,
          nftId: 1,
          nftImage: '$nft.image',
          status: 1,
          lockingBalance: 1,
        },
      },
    ];

    const result = await Utils.aggregatePaginate(
      this.ownerModel,
      pipe,
      requestData,
    );

    const groupStakingBalance = await this.ownerModel.aggregate([
      ...pipe,
      {
        $match: {
          status: { $in: [OwnerStatus.UNLOCKED, OwnerStatus.LOCKED] },
        },
      },
    ]);
    result.totalStakingBalance =
      groupStakingBalance?.length > 0 ? groupStakingBalance[0].stakingShare : 0;
    return result;
  }

  async getCommissionUser({ id, addr }: any, requestData: FindCommisionDto) {
    const { keyword, startDate, endDate, nftIds } = requestData;
    const userInfo = await this.findUserByAddressOrId({ id, addr });

    const andCondition: mongoose.FilterQuery<TransactionDocument>[] = [
      {
        $or: [
          {
            'affiliateInfor.referrerDirect.address': {
              $regex: userInfo.address,
              $options: 'i',
            },
          },
          {
            'affiliateInfor.bda.address': {
              $regex: userInfo.address,
              $options: 'i',
            },
          },
        ],
      },
      { status: TransactionStatus.SUCCESS },
      { type: TransactionType.MINTED },
    ];

    // search by referrer, buyer, event name
    if (keyword) {
      andCondition.push({
        $or: [
          { toAddress: Utils.formatAddress(keyword) },
          {
            'affiliateInfor.referrerDirect.address':
              Utils.formatAddress(keyword),
          },
          { 'event.name': { $regex: keyword, $options: 'i' } },
        ],
      });
    }

    // search transaction by start date
    if (startDate) {
      andCondition.push({ createdAt: { $gte: new Date(startDate) } });
    }

    // search transaction by end date
    if (endDate) {
      andCondition.push({ createdAt: { $lte: new Date(endDate) } });
    }

    // search transaction by nft category
    if (nftIds) {
      andCondition.push({
        'nft.id': { $in: nftIds },
      });
    }

    // caculate earning
    const earningPipe = {
      $add: [
        {
          $cond: [
            {
              $eq: ['$affiliateInfor.referrerDirect.address', userInfo.address],
            },
            { $toDecimal: '$affiliateInfor.referrerDirect.commissionFee' },
            0,
          ],
        },
        {
          $cond: [
            {
              $eq: ['$affiliateInfor.bda.address', userInfo.address],
            },
            { $toDecimal: '$affiliateInfor.bda.commissionFee' },
            0,
          ],
        },
      ],
    };

    // caculate commission
    const commissionPipe = {
      $add: [
        {
          $cond: [
            {
              $eq: ['$affiliateInfor.referrerDirect.address', userInfo.address],
            },
            {
              $multiply: ['$affiliateInfor.referrerDirect.percentage', HUNDRED],
            },
            0,
          ],
        },
        {
          $cond: [
            {
              $eq: ['$affiliateInfor.bda.address', userInfo.address],
            },
            {
              $multiply: ['$affiliateInfor.bda.percentage', HUNDRED],
            },
            0,
          ],
        },
      ],
    };

    const pipe = [
      {
        $match: { $and: andCondition },
      },
      {
        $project: {
          transactionDate: '$createdAt',
          buyer: '$toAddress',
          nameNft: '$nft.name',
          imageNft: '$nft.image',
          subTotal: '$revenue',
          referrer: '$affiliateInfor.referrerDirect.address',
          eventName: '$event.name',
          imageEvent: '$event.imgUrl',
          quantity: 1,
          nft: 1,
          event: 1,
          commision: commissionPipe,
          hash: 1,
          earnings: earningPipe,
        },
      },
    ];

    const result = await Utils.aggregatePaginate(
      this.transactionModel,
      pipe,
      requestData,
    );

    const totalInfoResult = await this.transactionModel.aggregate([
      { $match: { $and: andCondition } },
      {
        $group: {
          _id: null,
          totalVolume: { $sum: '$revenue' },
          totalTokensSold: { $sum: '$quantity' },
          totalEarnings: { $sum: earningPipe },
        },
      },
      { $unset: ['_id'] },
    ]);

    const itemCategories = await this.transactionModel.distinct('nft.id', {
      $and: andCondition,
    });

    result.itemCategories = itemCategories?.length || 0;

    return totalInfoResult?.length > 0
      ? {
          ...result,
          ...totalInfoResult[0],
        }
      : result;
  }

  async submitKyc(dataKyc: EventKYC) {
    const user = await this.userModel.findOne({
      address: { $regex: dataKyc.refId, $options: 'i' },
    });
    if (!user) {
      throw ApiError(ErrorCode.INVALID_DATA, 'Cannot found user');
    }
    switch (dataKyc.status) {
      case StatusKyc.APPROVED:
        user.kycInfo.waitingDate = dataKyc.waitingDate;
        user.kycInfo.approvedDate = dataKyc.approvedDate;
        user.kycInfo.inreviewDate = dataKyc.inreviewDate;
        user.kycInfo.kycStatus = KYCStatus.VERIFIED;
        user.kycInfo.event = dataKyc.event;
        break;
      case StatusKyc.REJECTED:
        user.kycInfo.event = dataKyc.event;
        user.kycInfo.kycStatus = KYCStatus.REJECTED;
        break;
      default:
        user.kycInfo.kycStatus = KYCStatus.PENDDING;
        user.kycInfo.event = dataKyc.event;
        break;
    }
    await user.save();
    
    return user;
  }

  async isValidReferrer({ id, addr }: any) {
    const userInfo = await this.findUserByAddressOrId({ id, addr });

    if (userInfo.kycInfo.kycStatus !== KYCStatus.VERIFIED) {
      throw ApiError(ErrorCode.INVALID_DATA, 'The referrer must kyc');
    }
    return userInfo;
  }

  async setAdmin({ address, adminName, permissions }) {
    await this.validateSetAdmin(address, adminName, permissions);
    const data = {
      account: address,
      action: AdminActions.ADD_ADMIN,
      permissions: permissions,
      adminName: adminName,
    };
  }

  async findAllAdmin(requestData: SearchAdminDto) {
    const conditionAnd: mongoose.FilterQuery<UserDocument>[] = [
      { status: { $ne: UserStatus.DRAFT } },
      { role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] } },
    ];
    // Search adminName, address
    if (requestData?.keyword) {
      const conditionOr = [
        { adminName: { $regex: requestData.keyword, $options: 'i' } }, // regex
        { address: Utils.formatAddress(requestData.keyword.trim()) },
      ];
      conditionAnd.push({ $or: conditionOr });
    }

    // Search user by start date
    if (requestData?.startDate) {
      conditionAnd.push({
        createdAt: { $gte: new Date(requestData?.startDate) },
      });
    }

    // Search user by end date
    if (requestData?.endDate) {
      conditionAnd.push({
        createdAt: { $lte: new Date(requestData?.endDate) },
      });
    }

    // Search admin by accessible module
    if (requestData?.accessModule) {
      conditionAnd.push({
        permissions: { $all: requestData?.accessModule },
      });
    }

    if (requestData?.status) {
      conditionAnd.push({
        status: requestData.status,
      });
    }

    const pipe: mongoose.PipelineStage[] = [{ $match: { $and: conditionAnd } }];

    if (requestData?.default) {
      pipe.push({
        $addFields: {
          isSuperAdmin: {
            $cond: {
              if: { $eq: ['$adminName', SUPER_ADMIN_NAME] },
              then: 1,
              else: 2,
            },
          },
        },
      });
      requestData.sort = {
        isSuperAdmin: 'asc',
        createdAt: 'desc',
      };
    }

    pipe.push({
      $addFields: {
        permissionQuantity: {
          $size: '$permissions',
        },
      },
    });

    return Utils.aggregatePaginate(this.userModel, pipe, requestData);
  }

  async validateSetAdmin(address: string, name: string, permissions: string[]) {
    const [listAdmins, isAdminNameExisted] = await Promise.all([
      this.userModel.find({ address }),
      this.userModel.findOne({ adminName: name }),
    ]);

    this.validatePermissionAdmin(permissions);

    for (const item of listAdmins) {
      if (item.role === UserRole.ADMIN && item.status !== UserStatus.DRAFT)
        throw ApiError(
          ErrorCode.ADMIN_WALLET_EXISTED,
          'Wallet address has existed',
        );
      if (item.role === UserRole.USER)
        throw ApiError(
          ErrorCode.REGISTED_AS_USER,
          'This wallet has registed as user',
        );
    }
    if (isAdminNameExisted)
      throw ApiError(ErrorCode.ADMIN_NAME_EXISTED, 'Admin Name has existed');
  }

  validatePermissionAdmin(permissions: string[]) {
    if (permissions) {
      permissions.forEach((item) => {
        if (!AdminPermissions[item])
          throw ApiError(
            ErrorCode.EDITION_UNSUCCESSFUL,
            'your permission is incorrect!',
          );
      });
    }
  }

  async updateAdmin(id: string, { adminName, permissions, status }) {
    let data: any = {};
    const admin = await this.validateUpdateAdmin(
      id,
      adminName,
      status,
      permissions,
    );
    let transaction: any;

    if (status) {
      // --- Active or Deactive admin
      const mapper = {
        [UserStatus.DEACTIVE]: AdminActions.DEACTIVATE,
        [UserStatus.ACTIVE]: AdminActions.ACTIVATE,
      };
      data = {
        account: admin.address,
        action: mapper[status],
        permissions: permissions ? permissions : admin.permissions,
      };
      if (adminName) data.adminName = adminName;
    } else {
      // ---- Update adminName, permissions
      if (permissions && admin.status === UserStatus.ACTIVE) {
        // on chain
        data = {
          account: admin.address,
          action: AdminActions.UPDATE_ADMIN,
          permissions: permissions,
        };
        if (adminName) {
          data.adminName = adminName;
        }
      }

      if (permissions) admin.permissions = permissions;

      if (adminName) admin.adminName = adminName;

      return admin.save();
    }
  }

  async validateUpdateAdmin(
    id: string,
    adminName: string,
    status: string,
    permissions: string[],
  ) {
    const admin = await this.userModel.findOne({
      _id: id,
      role: UserRole.ADMIN,
      isDeleted: false,
    });
    if (!admin)
      throw ApiError(ErrorCode.EDITION_UNSUCCESSFUL, 'Admin has not existed');

    if (admin.status === UserStatus.PROCESSING)
      throw ApiError(
        ErrorCode.EDITION_UNSUCCESSFUL,
        'Can not modify permission while status is processing',
      );

    this.validatePermissionAdmin(permissions);

    if (status)
      if (admin.status === status)
        // ----- validate Active or Deactive admin
        throw new BadRequestException();

    if (adminName) {
      const isAdminNameExisted = await this.userModel.findOne({
        adminName: adminName,
        _id: { $ne: id },
      });
      if (isAdminNameExisted)
        throw ApiError(ErrorCode.ADMIN_NAME_EXISTED, 'Admin Name has existed');
    }

    return admin;
  }

  async deleteAdmin(id: string) {
    const admin = await this.userModel.findOne({
      _id: id,
      isDeleted: false,
      role: UserRole.ADMIN,
      isHavingAction: false,
    });
    if (!admin || admin?.status === UserStatus.PROCESSING)
      throw new BadRequestException();

    const data = {
      account: admin.address,
      action: AdminActions.DELETE_ADMIN,
      permissions: [],
    };

  }

  async validatePermission(data) {
    const { address, adminName, status, permissions, id } = data;
    if (id) return this.validateUpdateAdmin(id, adminName, status, permissions);
    return this.validateSetAdmin(address, adminName, permissions);
  }
}

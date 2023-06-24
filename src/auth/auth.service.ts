import { NotificationType } from 'src/schemas/Notification.schema';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import {
  KYCStatus,
  User,
  UserDocument,
  UserRole,
  UserStatus,
  UserType,
} from 'src/schemas/User.schema';
// import Web3 from 'web3';
const Web3 = require('web3');
import { LoginDto } from './dto/login.dto';
// import { Role } from './role.enum';
import { Model } from 'mongoose';
import { Web3Gateway } from 'src/blockchain/web3.gateway';
import { Utils } from 'src/common/utils';
import { ApiError } from 'src/common/api';
import { ErrorCode, TYPE_LOGIN } from 'src/common/constants';
import { UpdateUserDto } from 'src/users/dto/update-user.dto';
import { CommonService } from 'src/common-service/common.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private readonly commonService: CommonService,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  /**
   * Login
   * @param {LoginDto} requestData
   * @return {any} user information
   */
  async login(requestData: LoginDto) {
    let address = '';
    let result: any;
    const web3Gateway = new Web3Gateway();
    // Verify signature
    try {
      address = await web3Gateway.recover(
        [requestData.address],
        requestData.signature,
      );
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
    if (requestData.address.toLowerCase() !== address.toLowerCase()) {
      this.logger.log(`Signature invalid. recover address = ${address}`);
      throw new UnauthorizedException();
    }
    // Get role
    let [ user] = await Promise.all([
      // web3Gateway.isSuperAdmin(address),
      this.userModel.findOne({ address }),
    ]);
    let isSuperAdmin = true
    let role: any;
    if (isSuperAdmin) role = UserRole.SUPER_ADMIN;
    else if (user && user?.role === UserRole.ADMIN) role = UserRole.ADMIN;
    // Update database
    const userType = user ? user.userType : '';
    if (user) {
      const isRegisteredAsUser =
        requestData.type === TYPE_LOGIN.USER &&
        [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role);

      // if((requestData.type === TYPE_LOGIN.USER && [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role))
      //   || (requestData.type === TYPE_LOGIN.ADMIN && user.role === UserRole.USER
      // ))
      // if (isRegisteredAsUser || isRegisteredAsAdmin) {
      //   throw ApiError(
      //     ErrorCode.ADMIN_LOGIN_USER,
      //     'The address has already been registed',
      //   );
      // }

   
    } else {
      if ([UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(role)) {
        result = await this.userModel.create({
          address,
          role,
          status: UserStatus.ACTIVE,
        });
      } else {
        result = await this.insertUser(address, requestData);
      }
    }

    const payload = {
      address: requestData.address,
      role,
      userType: userType || result?.userType,
    };
    return {
      address: requestData.address,
      token: this.jwtService.sign(payload),
      ...payload,
    };
  }

  async insertUser(address: string, requestData: LoginDto) {
    const userDto: any = {};
    const promiseNoti = [];

    let referrerInfo: any;
    if (requestData?.referrer) {
      referrerInfo = await this.userModel.findOne({
        address: requestData.referrer,
      });

      if (!referrerInfo) {
        throw ApiError(
          ErrorCode.INVALID_DATA,
          'The referrer has not existence',
        );
      }

      if (referrerInfo.role === UserRole.ADMIN) {
        throw ApiError(
          ErrorCode.INVALID_DATA,
          'The referrer must be different to admin',
        );
      }

      if (referrerInfo.kycInfo.kycStatus !== KYCStatus.VERIFIED) {
        throw ApiError(
          ErrorCode.INVALID_DATA,
          'The referrer must be verify kyc',
        );
      }

      // push noti for referrer address
      promiseNoti.push(
        this.commonService.pushNotificationUser(NotificationType.N13, {
          toAddress: referrerInfo.address,
          userAddress: address,
        }),
      );
      // push noti for originator address (BDA)
      promiseNoti.push(
        this.commonService.pushNotificationUser(NotificationType.N14, {
          toAddress: referrerInfo.originator,
          userAddress: address,
          referralAddress: referrerInfo.address,
        }),
      );
    } else {
      referrerInfo = await this.userModel.findOne({
        role: UserRole.SYSTEM,
      });
    }

    referrerInfo.directReferee += 1;
    // update equity shared
    await this.updateEquityShare(referrerInfo);
    await referrerInfo.save();

    userDto.address = address;
    userDto.referrer = referrerInfo.address;
    userDto.originator =
      referrerInfo.userType === UserType.BDA
        ? referrerInfo.address
        : referrerInfo.originator;
    userDto.pathId = [...referrerInfo.pathId, referrerInfo.address];

    const result = this.userModel.create(userDto);
    // push noti
    if (promiseNoti.length > 0) {
      await Promise.all(promiseNoti);
    }
    return result;
  }

  async updateEquityShare(referrerInfo: any) {
    if (this.commonService.isAbleToCaculateEquityShare(referrerInfo)) {
      const equityShares = await this.commonService.caculatingEnquityShares(
        referrerInfo,
        null,
      );
      referrerInfo.equityShare = equityShares;
    }
  }
}

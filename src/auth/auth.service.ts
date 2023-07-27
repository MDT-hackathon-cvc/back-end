import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import {
  User,
  UserDocument,
  UserRole,
} from 'src/schemas/User.schema';
import { LoginDto } from './dto/login.dto';
import { Model } from 'mongoose';
import { ApiError } from 'src/common/api';
import { ErrorCode, TYPE_LOGIN } from 'src/common/constants';
import { CommonService } from 'src/common-service/common.service';
import { ethers } from 'ethers';

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
    let { address, signature } = requestData
    let result: any;
    // Verify signature
    try {
      // Verify signature
      
        const message = ethers.utils.solidityKeccak256(["address"], [address]);
        const result = ethers.utils.verifyMessage(
          ethers.utils.arrayify(message),
          signature
        );
      
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
    if (requestData.address.toLowerCase() !== address.toLowerCase()) {
      this.logger.log(`Signature invalid. recover address = ${address}`);
      throw new UnauthorizedException();
    }
    // Get role
    let user= await this.userModel.findOne({ address });
    // let isSuperAdmin = true
    // Update database
    const userType = user ? user.userType : '';
    if (user) {
      const isRegisteredAsUser =
        requestData.type === TYPE_LOGIN.USER &&
        [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role);

 
      const isRegisteredAsAdmin =
        requestData.type === TYPE_LOGIN.ADMIN && user.role === UserRole.USER;

      if (isRegisteredAsUser || isRegisteredAsAdmin) {
        throw ApiError(
          ErrorCode.ADMIN_LOGIN_USER,
          'Bad request!',
        );
      }
    } else {
      result = await this.insertUser(address, requestData);
    }

    const payload = {
      address: requestData.address,
      role: user ? user.role : result.role,
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

    userDto.address = address;
    userDto.role  =UserRole.USER

    const result = this.userModel.create(userDto);
    return result;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import {
  Notification,
  NotificationAddress,
  NotificationDocument,
} from 'src/schemas/Notification.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { SearchDto } from 'src/common/search.dto';
import { Utils } from 'src/common/utils';
import mongoose from 'mongoose';
import { UserJWT } from 'src/auth/role.enum';
import { UserRole } from 'src/schemas/User.schema';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    private userService: UsersService,
  ) {}

  async findAll(requestData: SearchDto, user: UserJWT) {
    const userInfo: any = await this.userService.findByAddress(user.address);
    const conditions = [
      {
        address: user.address,
      },
      {
        receiverAddresses: user.address,
      },
    ];
    if (user.role === UserRole.USER) {
      conditions.push({
        address: NotificationAddress.USER,
      });
    }
    const pipe: mongoose.PipelineStage[] = [
      {
        $match: {
          $or: conditions,
          createdAt: {
            $gte: userInfo?.createdAt,
          },
        },
      },
      {
        $addFields: {
          isRead: {
            $cond: {
              if: {
                $in: [user.address, '$addressRead'],
              },
              then: true,
              else: false,
            },
          },
        },
      },
    ];
    const result = await Utils.aggregatePaginate(
      this.notificationModel,
      pipe,
      requestData,
    );
    const totalUnreads = await this.notificationModel.aggregate([
      ...pipe,
      {
        $match: {
          isRead: false,
        },
      },
    ]);
    result.totalUnread = totalUnreads.length;
    return result;
  }

  async markAsRead(id: string, user: UserJWT) {
    const notification = await this.notificationModel.findById(id);
    if (!notification.addressRead.includes(user.address)) {
      return notification.updateOne({
        $push: {
          addressRead: user.address,
        },
      });
    }
    return notification;
  }

  async markAsReadAll(user: UserJWT) {
    const conditions = [
      {
        address: user.address,
        addressRead: {
          $ne: user.address,
        },
      },
      {
        receiverAddresses: user.address,
        addressRead: {
          $ne: user.address,
        },
      },
    ];
    if (user.role === UserRole.USER) {
      conditions.push({
        address: NotificationAddress.USER,
        addressRead: {
          $ne: user.address,
        },
      });
    }
    await this.notificationModel.updateMany(
      {
        $or: conditions,
      },
      {
        $push: {
          addressRead: user.address,
        },
      },
    );
    return 'Success';
  }
}

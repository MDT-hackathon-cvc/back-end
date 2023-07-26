import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { User, UserDocument, UserRole } from 'src/schemas/User.schema';
import { SOCKET_ROOM } from './socket.enum';

@WebSocketGateway({
  cors: true,
})
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SocketGateway.name);

  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  @WebSocketServer()
  server: Server;

  afterInit() {
    this.logger.log('Initialize WebSocket');
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const address: string = client.handshake.query['address'].toString();
    const user = await this.userModel.findOne({ address });
    client.leave(address);
    if (user?.role === UserRole.USER) {
      client.leave(SOCKET_ROOM.USER);
    }
  }

  async handleConnection(client: Socket, ...args: any[]) {
    if (!client.handshake.query['address']) {
      this.logger.error(`Missing required parameters: address`);
      client.disconnect(true);
      return;
    }
    const address: string = client.handshake.query['address'].toString();
    this.logger.log(`Client connected [${client.id}]: ${address}`);
    const user = await this.userModel.findOne({ address });
    client.join(address);
    if (user?.role === UserRole.USER) {
      client.join(SOCKET_ROOM.USER);
    }
  }
}

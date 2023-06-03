import { Logger } from '@nestjs/common';
import { IIPFS } from './ipfs.type';
const { create, urlSource } = require('ipfs-http-client');

export class IpfsSelfHost implements IIPFS {
  private readonly logger = new Logger(IpfsSelfHost.name);

  private client;

  constructor() {
    this.client = create(process.env.IPFS_URI);
  }

  public async upload(content: Express.Multer.File) {
    const { cid } = await this.client.add(content.buffer);
    return cid.toString();
  }

  public async uploadFromURL(url: string) {
    const { cid } = await this.client.add(urlSource(url));
    return cid.toString();
  }
}

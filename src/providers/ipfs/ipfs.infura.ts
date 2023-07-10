import { IIPFS } from './ipfs.type';
import axios from 'axios';
import { Buffer } from 'buffer';
import { Injectable } from '@nestjs/common';
import { IPFSHTTPClient, create } from 'ipfs-http-client';


@Injectable()
export class IpfsInfura implements IIPFS {
  private readonly ipfsClient: IPFSHTTPClient;

  constructor( ) {
    this.ipfsClient = create({
      host: 'ipfs.infura.io',
      port: 5001,
      protocol: 'https',
      apiPath: '/api/v0',
      headers: {
        authorization:
          'Basic ' +
          Buffer.from(
            process.env.IPFS_INFURA_API_KEY +
              ':' +
              process.env.IPFS_INFURA_SECRET,
          ).toString('base64'),
      },
    });

  }

  async upload(content: Express.Multer.File): Promise<string> {
    // Add the content to IPFS
    const { cid } = await this.ipfsClient.add(content.buffer);

    return process.env.INFURA_DELICATE_URL + '/ipfs/' + cid.toString();
  }

  public async uploadFromURL(url: string, mimeType: any) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'utf-8');
    return this.upload({
      buffer,
      mimetype: mimeType,
    } as any);
  }

  public async uploadMetadataToIpfs(data) {
    const { cid } = await this.ipfsClient.add(JSON.stringify(data));
    return process.env.INFURA_DELICATE_URL + '/ipfs/' + cid.toString();
  }
}

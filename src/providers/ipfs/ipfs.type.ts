export interface IIPFS {
  upload(content: Express.Multer.File): Promise<string>;

  uploadFromURL(url: string, mimeType: any): Promise<string>;

  uploadMetadataToIpfs(data: any): Promise<string>
}

export enum IpfsClientType {
  SELF_HOST = 'self-host',
  NFT_STORAGE = 'nft-storage',
  WEB3_STORAGE = 'web3-storage',
  PINATA_CLOUD = 'pinata-cloud',
  INFURA = 'infura'
}

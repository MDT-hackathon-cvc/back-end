import { NFTDocument, TokenStandard } from 'src/schemas/NFT.schema';

export interface IWeb3API {
  sign(data: any[], privateKey: string): string;

  recover(data: any[], signature: string): string;

  toChecksumAddress(address: string): string;

  getTransaction(hash: string): Promise<Web3Transaction>;

  getTransactionReceipt(hash: string): Promise<Web3TransactionReceipt>;

  balanceOf(address: string, tokenId: number): Promise<number>;

  ownerOf(tokenId: number): Promise<string>;

  balanceOfBatch(address: string[], tokenIds: number[]): Promise<number[]>;

  getLatestBlock(): Promise<number>;

  getPastEvents721(
    event: string,
    fromBlock: number,
    toBlock: number,
  ): Promise<Web3PastEvent[]>;

  getPastEvents1155(
    event: string,
    fromBlock: number,
    toBlock: number,
  ): Promise<Web3PastEvent[]>;

  getMethodByHash(hash: string): Promise<We3TransactionMethod>;

  getEventByHash(hash: string): Promise<Web3TransactionEvent[]>;

  isAdmin(address: string): Promise<boolean>;

  isBlacklisted(address: string): Promise<boolean>;

  getSigner(): Promise<string>;

  createAccount(): Promise<Account>;

  getAddress721(): Promise<string>;

  getTokensByAddress721(address: string): Promise<Web3Token[]>;

  getTokensByNFT(nft: NFTDocument): Promise<Web3Token[]>;

  getTokensByAddressAndNFT(
    address: string,
    nft: NFTDocument,
  ): Promise<Web3Token[]>;

  isSuperAdmin(address: string): Promise<boolean>;
}

export interface Web3Transaction {
  hash: string;
  nonce: number;
  blockHash: string;
  blockNumber: number;
  transactionIndex: number;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gas: number;
  input: string;
}

export interface Web3TransactionReceipt {
  status: boolean;
  transactionHash: string;
  transactionIndex: number;
  blockHash: string;
  blockNumber: number;
  from: string;
  to: string;
  contractAddress?: string;
  cumulativeGasUsed: number;
  gasUsed: number;
  effectiveGasPrice: number;
  logs: Log[];
  logsBloom: string;
  events?: {
    [eventName: string]: EventLog;
  };
}

export interface EventLog {
  event: string;
  address: string;
  returnValues: any;
  logIndex: number;
  transactionIndex: number;
  transactionHash: string;
  blockHash: string;
  blockNumber: number;
  raw?: { data: string; topics: any[] };
}

export interface Log {
  address: string;
  data: string;
  topics: string[];
  logIndex: number;
  transactionIndex: number;
  transactionHash: string;
  blockHash: string;
  blockNumber: number;
}

export interface We3TransactionMethod {
  name: string;
  events: Web3TransactionMethodEventParam[];
}

export interface Web3TransactionEvent {
  name: string;
  address: string;
  events: Web3TransactionMethodEventParam[];
}

export interface Web3TransactionMethodEventParam {
  name: string;
  type: string;
  value: string;
}

export interface Web3Token {
  nftId?: any;
  tokenId?: string;
  mintedBy?: string;
  isMintedByAdmin?: boolean;
  address?: string;
  isAddressAdmin?: boolean;
  quantity?: number;
  updatedAt: number;
}

export interface Web3PastEvent {
  returnValues: {
    [key: string]: any;
  };
  // raw: {
  //   data: string;
  //   topics: string[];
  // };
  event: string;
  signature: string;
  logIndex: number;
  transactionIndex: number;
  transactionHash: string;
  blockHash: string;
  blockNumber: number;
  address: string;
}

export interface Account {
  address: string;
  privateKey: string;
}

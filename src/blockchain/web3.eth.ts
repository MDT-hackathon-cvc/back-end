import { Logger } from '@nestjs/common';
import { ApiError } from 'src/common/api';
import { ErrorCode } from 'src/common/constants';
import { Utils } from 'src/common/utils';
import { NFTDocument, TokenStandard } from 'src/schemas/NFT.schema';
import Web3Type from 'web3';
import { Contract } from 'web3-eth-contract';
import { IWeb3API, Web3Token } from './web3.type';
const Web3 = require('web3');
const contract721Abi = require('./contract/erc721.json');
const contract1155Abi = require('./contract/erc1155.json');
const contractExchangeAbi = require('./contract/Brillianz.json');
const contractEventsAbi = require('./contract/events.json');
const contractErc20Abi = require('./contract/erc20.json');
const lockingAbi = require('./contract/Locking.json');
const abiDecoder = require('abi-decoder');

export class Web3ETH implements IWeb3API {
  private readonly logger = new Logger(Web3ETH.name);

  private web3Instance: Web3Type;
  private contract721: Contract;
  private contract1155: Contract;
  private contractExchange: Contract;
  private contractErc20: Contract;
  private lockingContract: Contract;

  constructor() {
    if (!this.web3Instance) {
      this.web3Instance = new Web3();
    }
  }

  private async setProvider() {
    while (true) {
      const rpcUrl = Utils.getRandom(process.env.CHAIN_RPC_URL.split(','));
      this.logger.debug(
        `setProvider(): ${this.web3Instance.currentProvider} -> ${rpcUrl}`,
      );
      this.web3Instance.setProvider(rpcUrl);
      try {
        const isSyncing = await this.web3Instance.eth.isSyncing();
        if (isSyncing === false) {
          break;
        }
        this.logger.warn(`setProvider(): ${rpcUrl} is syncing. Change RPC`);
        this.logger.debug(isSyncing);
      } catch (error) {
        this.logger.error(error);
      }
    }
    this.contract721 = new this.web3Instance.eth.Contract(
      contract721Abi.output.abi,
      process.env.CONTRACT_ERC_721,
    );

    this.contract1155 = new this.web3Instance.eth.Contract(
      contract1155Abi.output.abi,
      process.env.CONTRACT_ERC_1155,
    );

    this.contractExchange = new this.web3Instance.eth.Contract(
      contractExchangeAbi.abi,
      process.env.CONTRACT_EXCHANGE,
    );

    this.lockingContract = new this.web3Instance.eth.Contract(
      lockingAbi.abi,
      process.env.CONTRACT_LOCKING,
    );

    this.contractErc20 = new this.web3Instance.eth.Contract(
      contractErc20Abi.abi,
      process.env.CONTRACT_ERC_20,
    );

    abiDecoder.addABI(contractEventsAbi);
  }

  private convertDataSign(data: any[]) {
    const {
      CONTRACT_SUBMIT_REDEMPTION_CODE,
      CONTRACT_CANCEL_REDEMPTION_CODE,
      CONTRACT_APPROVE_REDEMPTION_CODE,
      CONTRACT_CANCEL_EVENT_CODE,
      NFT_MANAGEMENT,
      USER_MANAGEMENT,
      EVENT_MANAGEMENT,
      LOCKING_MANAGEMENT,
      REDEMPTION_MANAGEMENT,
      REVENUE_MANAGEMENT,
    } = process.env;

    const dataSign: any = [];
    for (let index = 0; index < data.length; index++) {
      const value = data[index];
      if (typeof value === 'number') {
        dataSign.push({
          type: 'uint256',
          value: value,
        });
      } else if (typeof value === 'string') {
        if (
          [
            CONTRACT_SUBMIT_REDEMPTION_CODE,
            CONTRACT_CANCEL_REDEMPTION_CODE,
            CONTRACT_APPROVE_REDEMPTION_CODE,
            CONTRACT_CANCEL_EVENT_CODE,
          ].includes(value)
        ) {
          dataSign.push({
            type: 'bytes32',
            value: value,
          });
        } else if (this.web3Instance.utils.isAddress(value)) {
          dataSign.push({
            type: 'address',
            value: value,
          });
        } else if (value.startsWith('0x')) {
          dataSign.push({
            type: 'bytes',
            value: value,
          });
        } else {
          dataSign.push({
            type: 'string',
            value: value,
          });
        }
      } else if (this.web3Instance.utils.isBigNumber(value)) {
        dataSign.push({
          type: 'uint256',
          value: value.toString(),
        });
      } else if (Array.isArray(value)) {
        if (
          [
            NFT_MANAGEMENT,
            USER_MANAGEMENT,
            EVENT_MANAGEMENT,
            LOCKING_MANAGEMENT,
            REDEMPTION_MANAGEMENT,
            REVENUE_MANAGEMENT,
          ].includes(value[0])
        ) {
          dataSign.push({
            type: 'bytes32[]',
            value: value,
          });
        } else if (value[0]?.length === 26) {
          dataSign.push({
            type: 'bytes',
            value: value,
          });
        } else {
          dataSign.push({
            type: 'uint256[]',
            value: value,
          });
        }
      }
    }
    this.logger.debug('convertDataSign(): dataSign', JSON.stringify(dataSign));
    return dataSign;
  }

  public sign(data: any[], privateKey: string) {
    const dataSign = this.convertDataSign(data);
    const hash = this.web3Instance.utils.soliditySha3(...dataSign);
    const sign = this.web3Instance.eth.accounts.sign(hash, privateKey);
    this.logger.debug('sign(): sign', sign);
    return sign.signature;
  }

  public recover(data: any[], signature: string) {
    const dataSign = this.convertDataSign(data);
    const hash = this.web3Instance.utils.soliditySha3(...dataSign);
    return this.web3Instance.eth.accounts.recover(hash, signature);
  }

  public toChecksumAddress(address: string) {
    try {
      return this.web3Instance.utils.toChecksumAddress(address);
    } catch (error) {
      return address;
    }
  }

  public checkAddress(address: string) {
    return this.web3Instance.utils.isAddress(address);
  }

  public async getTransaction(hash: string) {
    await this.setProvider();
    return await this.web3Instance.eth.getTransaction(hash);
  }

  public async getTransactionReceipt(hash: string) {
    await this.setProvider();
    return await this.web3Instance.eth.getTransactionReceipt(hash);
  }

  public async balanceOfDeposit(address: string) {
    await this.setProvider();
    return await this.contractErc20.methods.balanceOf(address).call();
  }

  public async balanceOf(address: string, tokenId: number) {
    await this.setProvider();
    if (tokenId) {
      return await this.contract1155.methods.balanceOf(address, tokenId).call();
    } else {
      return await this.contract721.methods.balanceOf(address).call();
    }
  }

  public async ownerOf(tokenId: number) {
    try {
      await this.setProvider();
      return await this.contract721.methods.ownerOf(tokenId).call();
    } catch (error) {
      if (error.toString().indexOf('owner query for nonexistent token') > -1) {
        throw ApiError(ErrorCode.INVALID_DATA, error.toString());
      }
      throw error;
    }
  }

  public async balanceOfBatch(address: string[], tokenIds: number[]) {
    await this.setProvider();
    return await this.contract1155.methods
      .balanceOfBatch(address, tokenIds)
      .call();
  }

  public async getLatestBlock() {
    await this.setProvider();
    const latestBlock = await this.web3Instance.eth.getBlockNumber();
    this.logger.debug(`getLatestBlock(): latestBlock`, latestBlock);
    return latestBlock;
  }

  public async getPastEvents721(
    event: string,
    fromBlock: number,
    toBlock: number,
  ) {
    await this.setProvider();
    const result = await this.contract721.getPastEvents(event, {
      fromBlock,
      toBlock,
    });
    this.logger.debug(`getPastEvents721(): result = ${JSON.stringify(result)}`);
    return result;
  }

  public async getPastEvents1155(
    event: string,
    fromBlock: number,
    toBlock: number,
  ) {
    await this.setProvider();
    const result = await this.contract1155.getPastEvents(event, {
      fromBlock,
      toBlock,
    });
    this.logger.debug(
      `getPastEvents1155(): result = ${JSON.stringify(result)}`,
    );
    return result;
  }

  public async getMethodByHash(hash: string) {
    await this.setProvider();
    const transaction = await this.getTransaction(hash);
    return abiDecoder.decodeMethod(transaction.input);
  }

  public async getEventByHash(hash: string) {
    await this.setProvider();
    const receipt = await this.web3Instance.eth.getTransactionReceipt(hash);
    if (
      receipt.to.toLowerCase() !== process.env.CONTRACT_EXCHANGE.toLowerCase()
    ) {
      this.logger.debug('getEventByHash(): receipt', receipt);
      throw ApiError(
        ErrorCode.INVALID_DATA,
        'The transaction is not from exchange contract',
      );
    }
    return abiDecoder.decodeLogs(receipt.logs);
  }

  public async isAdmin(address: string) {
    await this.setProvider();
    return await this.contractExchange.methods.isAdmin(address).call();
  }

  public async isSuperAdmin(address: string) {
    await this.setProvider();
    return await this.contractExchange.methods.isSuperAdmin(address).call();
  }

  public async isBlacklisted(address: string) {
    await this.setProvider();
    return await this.contractExchange.methods.isBlacklisted(address).call();
  }

  public async getSigner() {
    await this.setProvider();
    return await this.contractExchange.methods.signer().call();
  }

  public async createAccount() {
    await this.setProvider();
    return await this.web3Instance.eth.accounts.create();
  }

  public async getAddress721() {
    await this.setProvider();
    return await this.contractExchange.methods.collection721().call();
  }

  public async getTokensByAddress721(address: string) {
    await this.setProvider();
    const tokens: Web3Token[] = [];

    const token721s = await this.contract721.methods
      .getOwnedNFTDetail(address)
      .call();
    this.logger.debug('getTokensByAddress721(): ', JSON.stringify(token721s));
    if (token721s && token721s[0]) {
      const nftIds = token721s[0];
      const quantities = token721s[1];
      const updatedAts = token721s[2];

      for (let index = 0; index < nftIds.length; index++) {
        const nftId = Utils.convertBytesToString(nftIds[index]);
        const quantity = Number(quantities[index]);
        const updatedAt = Number(updatedAts[index]);
        tokens.push({
          nftId,
          quantity,
          updatedAt,
        });
      }
    }
    return tokens;
  }

  public async getTokensByNFT(nft: NFTDocument) {
    await this.setProvider();
    if (nft.token.standard === TokenStandard.ERC_721) {
      const result = await this.contract721.methods
        .getNFT(Utils.convertToBytes(nft.id))
        .call();
      this.logger.debug('getTokensByNFT(): ', JSON.stringify(result));
      const tokens: Web3Token[] = [];
      if (result && result[1]) {
        for (let index = 0; index < result[0].length; index++) {
          const tokenId = result[0][index];
          const updatedAt = Number(result[1][index]);
          const address = result[2][index];
          const mintedBy = result[3][index];
          const isAddressAdmin = result[4][index];
          const isMintedByAdmin = result[5][index];
          tokens.push({
            nftId: nft.id,
            tokenId,
            mintedBy,
            isMintedByAdmin,
            address,
            isAddressAdmin,
            quantity: 1,
            updatedAt,
          });
        }
      }
      return tokens;
    }
    // else if (nft.token.standard === TokenStandard.ERC_1155) {
    //   const result = await this.contract1155.methods
    //     .getNFT(Utils.convertToBytes(nft.id))
    //     .call();
    //   this.logger.debug('getTokensByNFT(): ', JSON.stringify(result));
    //   const tokens: Web3Token[] = [];
    //   if (result && result[0]) {
    //     const tokenId = result[0];
    //     const updatedAt = Number(result[1]);
    //     const quantities = result[2];
    //     const owners = result[3];
    //     const isAdmins = result[4];

    //     for (let index = 0; index < quantities.length; index++) {
    //       const quantity = Number(quantities[index]);
    //       const address = owners[index];
    //       const isAddressAdmin = isAdmins[index];
    //       const mintedBy = '';
    //       const isMintedByAdmin = false;
    //       tokens.push({
    //         nftId: nft.id,
    //         tokenId,
    //         mintedBy,
    //         isMintedByAdmin,
    //         address,
    //         isAddressAdmin,
    //         quantity,
    //         updatedAt,
    //       });
    //     }
    //   }
    //   return tokens;
    // }
  }

  public async getTokensByAddressAndNFT(address: string, nft: NFTDocument) {
    await this.setProvider();
    const tokens: Web3Token[] = [];

    if (nft.token.standard === TokenStandard.ERC_721) {
      const token721s = await this.contract721.methods
        .getOwnedNFT(address, Utils.convertToBytes(nft.id))
        .call();
      this.logger.debug(
        'getTokensByAddressAndNFT(): ERC-721',
        JSON.stringify(token721s),
      );
      if (token721s && token721s[0]) {
        for (let index = 0; index < token721s[0].length; index++) {
          const tokenId = token721s[0][index];
          if (tokenId === '0') {
            continue;
          }
          const updatedAt = Number(token721s[1][index]);
          tokens.push({
            nftId: nft.id,
            tokenId,
            quantity: 1,
            updatedAt,
          });
        }
      }
    }
    // else if (nft.token.standard === TokenStandard.ERC_1155) {
    //   const token1155s = await this.contract1155.methods
    //     .getOwnedNFT(address, Utils.convertToBytes(nft.id))
    //     .call();
    //   this.logger.debug(
    //     'getTokensByAddressAndNFT(): ERC-1155',
    //     JSON.stringify(token1155s),
    //   );
    //   if (token1155s && token1155s[0]) {
    //     const tokenId = token1155s[0];
    //     const quantity = Number(token1155s[1]);
    //     if (tokenId === '0' || quantity === 0) {
    //       return tokens;
    //     }
    //     const updatedAt = Number(token1155s[2]);
    //     tokens.push({
    //       nftId: nft.id,
    //       tokenId,
    //       quantity,
    //       updatedAt,
    //     });
    //   }
    // }
    return tokens;
  }

  async getNonces(address: string) {
    await this.setProvider();
    return this.contractExchange.methods.nonces(address).call();
  }
}

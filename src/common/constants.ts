export const ErrorCode = {
  INVALID_DATA: 'E99',
  LAUNCH_EVENT_ERR: 'E10',
  NO_DATA_EXISTS: 'E14',
  ALREADY_COMPLETED: 'already completed',
  INVALID_FILE: 'Invalid file',
  NUMBER_MUST_GREATER: 'E8',
  REGISTED_AS_USER: 'E37',
  ADMIN_WALLET_EXISTED: 'E45',
  ADMIN_NAME_EXISTED: 'E46',
  ADMIN_HAS_DELETED: 'E42',
  ADMIN_STATUS_INVALID: 'E41',
  USER_NOT_BDA: 'E50',
  USER_HAD_NFT_BLACK: 'E51',
  UNSUCCESS_TRANSACTION: 'E11',
  ADMIN_LOGIN_USER: 'E4',
  NO_TOKEN_EXISTS: 'E55',
  TOKEN_IS_INVALID: 'E54',
  INVALID_ADDRESS: 'E18',
  EDITION_UNSUCCESSFUL: 'E31',
  INSUFFICIENT_QUANTITY_NFT: 'E24',
  INVALID_REFERRER: 'E19',
};

export const IntegrationErrorCode = {
  FAILED_CODE: 0,
  SUCCESSFUL_CODE: 1,
};

export const ErrorMessage = {
  INVALID_OBJECT_ID: 'Invalid ObjectId',
  INVALID_DATA: 'Invalid Data',
};

export const USDT = 'usdt';
export const LIMIT_PER_TRANSACTION = 50;

export const FILE = {
  WHITE_LIST_SUPPORT:
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  MAX_ROWS_WHITE_LIST: 50,
  MAX_WHITE_LIST_FILE: 2 * 1024 * 1024,
  IMAGE_SUPPORT: ['.png', '.jpg', '.jpeg', '.gif'],
};

export const NFTAttributeType = 'type';
export enum NFTType {
  ERC_721 = 'Hero',
  ERC_1155 = 'Item',
}

export const Contract = {
  EVENT: {
    ADMIN_MINT_NFT: 'BlackDiamondMinted',
    MINT_NFT: 'DiamondMinted',
    CANCEL_SALE_ORDER: 'CancelOrderEvent',
    SET_ADMIN: 'SetAdminEvent',
    TRANSFER: 'Transfer',
    REDEMPTION_SUBMITTED: 'RedemptionSubmitted',
    REDEMPTION_CANCELED: 'RedemptionCancelled',
    REDEMPTION_APPROVE: 'RedemptionApproved',
    EVENT_CANCELED: 'EventCancelled',
    LOCKED: 'Locked',
    UNLOCKED: 'Unlocked',
    PERMISSION_UPDATE: 'PermissionUpdated',
    CLAIMED: 'Claimed',
    DEPOSITED: 'Deposited',
    RECOVER_MINTED: 'RecoverMinted',
  },
  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
  TOKEN_TYPE: {
    ERC_721: 0,
    ERC_1155: 1,
  },
};

export const MIMEType = {
  APPLICATION_JSON: 'application/json',
  IMAGE_PNG: 'image/png',
};

export const QUEUE = {
  UPLOAD_IPFS: 'UPLOAD_IPFS',
  TRANSACTION_PROCESSING: 'TRANSACTION_PROCESSING',
  KYC: 'KYC',
};

export const QUEUE_SETTINGS = {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
  delayedDebounce: 5000,
  removeOnSuccess: true,
  activateDelayedJobs: true,
};

export const MAX_RETRY = 3;

export const TIME_WAIT_RETRY = 300;

export const BlockChain = {
  Network: {
    BSC: [56, 97],
    ETH: [1, 3, 4, 5, 42],
    POLYGON: [137, 80001],
    CVC: [5555]
  },
};

export const CacheKeyName = {
  GET_CONFIG: {
    NAME: 'get-config',
    TTL: 300,
  },
  GET_FULL_CONFIG: {
    NAME: 'get-full-config',
    TTL: 300,
  },
  GET_TRANSACTIONS_DETAIL_BY_ID: (transactionId) => {
    return `get-transaction-detail-by-id-${transactionId}`;
  },
  GET_TOKENS_BY_NFT: (nftId) => {
    return `get-tokens-by-nft-${nftId}`;
  },
  GET_TOKEN_BY_ADDRESS: (address) => {
    return `get-tokens-by-address-${address}`;
  },
  GET_TOKEN_BY_ADDRESS_AND_NFT: (address, nftId) => {
    return `get-tokens-by-address-and-nft-${address}-${nftId}`;
  },
  GET_OWNER_QUANTITY: (tokenId, address) => {
    return `get-owner-quantity-${tokenId}-${address}`;
  },
};

export const FIX_FLOATING_POINT = 1000000;

export const DEFAULT_CURRENCY_NAME = 'usdt';

export const TIME_OF_YEAR = 365 * 24 * 60 * 60 * 1000;
export const THREE_MINUTES = 3 * 60 * 1000;

export const DEFAULT_REFERRER = '0x0000000000000000000000000000000000000000';
export const DEFAULT_BDA = '0x0000000000000000000000000000000000000000';
export const DEFAULT_COMMISSION_RATIO = 0;
export const DEFAULT_BDA_RATIO = 0;
export const DEFAULT_DIVISOR = 10000;
export const HUNDRED = 100;
export const THOUSAND = 1000;

export const CONFIG_TO_BECOME_BDA = 50000;
export const VALUE_A_SHARE = 150000;
export const FORTY_PERCENT = 0.4;

export const DEPOSIT_KEY = 'deposit';

export enum PartnerHeaders {
  API_KEY = 'abc@123',
}
export const MIN_DISTRIBUTED_REWARD = 10 ** -6;

export enum TYPE_LOGIN {
  ADMIN = 'admin',
  USER = 'user',
}

export enum ROLE_NOTI {
  BDA = 'BDA',
  DIRECT_REFERRE = 'Direct Referrer',
  BDA_DIRECT_REFERRE = 'BDA & Direct Referrer',
}

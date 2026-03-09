import { parseAbi } from "viem"

// Source: https://github.com/GoodDollar/GoodProtocol/blob/master/releases/deployment.json
export const RESERVE_CONTRACT_ADDRESSES = {
  production: {
    celo: {
      exchangeHelper: "0xE45CaB86609a16dFaDec112FDd61E4EA80EdaA8D" as const,
      buyGDFactory: "0x1F60C4C7037C6766924A43666B781ED1479587a2" as const,
      goodDollar: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as const,
      reserveToken: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const,
    },
    xdc: {
      exchangeHelper: undefined,
      buyGDFactory: undefined,
      goodDollar: "0xEC2136843a983885AebF2feB3931F73A8eBEe50c" as const,
      reserveToken: "0xfA2958CB79b0491CC627c1557F441eF849Ca8eb1" as const,
    },
  },
  staging: {
    celo: {
      exchangeHelper: "0xE45CaB86609a16dFaDec112FDd61E4EA80EdaA8D" as const,
      buyGDFactory: "0x1F60C4C7037C6766924A43666B781ED1479587a2" as const,
      goodDollar: "0x61FA0fB802fd8345C06da558240E0651886fec69" as const,
      reserveToken: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const,
    },
    xdc: {
      exchangeHelper: undefined,
      buyGDFactory: undefined,
      goodDollar: "0xEC2136843a983885AebF2feB3931F73A8eBEe50c" as const, // Uses prod addresses per protocol standard unless specified
      reserveToken: "0xfA2958CB79b0491CC627c1557F441eF849Ca8eb1" as const,
    },
  },
  development: {
    celo: {
      exchangeHelper: "0xE45CaB86609a16dFaDec112FDd61E4EA80EdaA8D" as const,
      buyGDFactory: "0x1F60C4C7037C6766924A43666B781ED1479587a2" as const,
      goodDollar: "0xFa51eFDc0910CCdA91732e6806912Fa12e2FD475" as const,
      reserveToken: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const,
    },
    xdc: {
      // NOTE: development-xdc uses MentoBroker/MentoReserve, not standard ExchangeHelper right now.
      // So these are technically undefined until standard reserve contracts hit.
      exchangeHelper: undefined,
      buyGDFactory: undefined,
      goodDollar: "0xA13625A72Aef90645CfCe34e25c114629d7855e7" as const,
      reserveToken: "0xCCE5f6B605164B7784b4719829d84b0f7493b906" as const,
    },
  },
} as const

export const CELO_CHAIN_ID = 42220
export const XDC_CHAIN_ID = 50

export const exchangeHelperABI = parseAbi([
  "function buy(address _buyWith, uint256 _tokenAmount, uint256 _minReturn) returns (uint256)",
  "function sell(address _sellWith, uint256 _gdAmount, uint256 _minReturn) returns (uint256)",
  "event TokenPurchased(address indexed caller, address indexed inputToken, uint256 inputAmount, uint256 actualReturn, address indexed receiverAddress)",
  "event TokenSold(address indexed caller, address indexed outputToken, uint256 gdAmount, uint256 contributionAmount, uint256 actualReturn, address indexed receiverAddress)",
])

export const buyGDFactoryABI = parseAbi([
  "function getBuyQuote(address _buyWith, uint256 _tokenAmount) view returns (uint256 gdAmount)",
  "function getSellQuote(uint256 _gdAmount, address _sellTo) view returns (uint256 tokenAmount)",
])

export const erc20ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
])

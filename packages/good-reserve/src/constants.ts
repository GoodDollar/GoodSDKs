import { parseAbi, type Address } from "viem"

// Sources:
// - https://github.com/GoodDollar/GoodProtocol/blob/master/releases/deployment.json
// - https://github.com/GoodDollar/GoodProtocol/blob/master/releases/deploy-settings.json
export const CELO_CHAIN_ID = 42220
export const XDC_CHAIN_ID = 50

export type SupportedReserveChain = "celo" | "xdc"

export type ExchangeHelperReserveConfig = {
  mode: "exchange-helper"
  exchangeHelper: Address
  buyGDFactory: Address
  goodDollar: Address
  stableToken: Address
}

export type MentoBrokerReserveConfig = {
  mode: "mento-broker"
  broker: Address
  exchangeProvider: Address
  goodDollar: Address
  stableToken: Address
}

export type UnavailableReserveConfig = {
  mode: "unavailable"
  reason: string
  goodDollar: Address
  stableToken: Address
}

export type ReserveChainConfig =
  | ExchangeHelperReserveConfig
  | MentoBrokerReserveConfig
  | UnavailableReserveConfig

export const RESERVE_CONTRACT_ADDRESSES = {
  production: {
    celo: {
      mode: "mento-broker",
      broker: "0x88de45906D4F5a57315c133620cfa484cB297541",
      exchangeProvider: "0x2fFBB49055d487DdBBb0C052Cd7c2a02A7971e41",
      goodDollar: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A",
      stableToken: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    },
    xdc: {
      mode: "unavailable",
      reason:
        "XDC production reserve swap endpoints are not published in GoodProtocol deployment.json yet",
      goodDollar: "0xEC2136843a983885AebF2feB3931F73A8eBEe50c",
      stableToken: "0xfA2958CB79b0491CC627c1557F441eF849Ca8eb1",
    },
  },
  staging: {
    celo: {
      mode: "mento-broker",
      broker: "0xAb075a5275EF8aCb906016382Cd65F15f312940C",
      exchangeProvider: "0xc04C2585917bFA5A37f452Ac838AeacA4d1C99Ce",
      goodDollar: "0x61FA0fB802fd8345C06da558240E0651886fec69",
      stableToken: "0xeed145D8d962146AFc568E9579948576f63D5Dc2",
    },
    xdc: {
      mode: "unavailable",
      reason:
        "XDC staging reserve swap endpoints are not published in GoodProtocol deployment.json",
      goodDollar: "0xEC2136843a983885AebF2feB3931F73A8eBEe50c",
      stableToken: "0xfA2958CB79b0491CC627c1557F441eF849Ca8eb1",
    },
  },
  development: {
    celo: {
      mode: "mento-broker",
      broker: "0xE60cf1cb6a56131CE135c604D0BD67e84B57CA3C",
      exchangeProvider: "0x558eC7E55855FAC9403De3ADB3aa1e588234A92C",
      goodDollar: "0xFa51eFDc0910CCdA91732e6806912Fa12e2FD475",
      stableToken: "0xeed145D8d962146AFc568E9579948576f63D5Dc2",
    },
    xdc: {
      mode: "mento-broker",
      broker: "0x6ef11986dc7ebde345134068877efecd18d7430c",
      exchangeProvider: "0x1fad5a713da1f51e2a1ac4ca2e1d621919f0aba0",
      goodDollar: "0xA13625A72Aef90645CfCe34e25c114629d7855e7",
      stableToken: "0xCCE5f6B605164B7784b4719829d84b0f7493b906",
    },
  },
} as const satisfies Record<
  "production" | "staging" | "development",
  Record<SupportedReserveChain, ReserveChainConfig>
>

export const getReserveChainFromId = (
  chainId: number,
): SupportedReserveChain | null => {
  if (chainId === CELO_CHAIN_ID) return "celo"
  if (chainId === XDC_CHAIN_ID) return "xdc"
  return null
}

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

export const mentoBrokerABI = parseAbi([
  "function getAmountOut(address exchangeProvider, bytes32 exchangeId, address tokenIn, address tokenOut, uint256 amountIn) view returns (uint256 amountOut)",
  "function swapIn(address exchangeProvider, bytes32 exchangeId, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin) returns (uint256 amountOut)",
  "event Swap(address exchangeProvider, bytes32 indexed exchangeId, address indexed trader, address indexed tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)",
])

export const mentoExchangeProviderABI = parseAbi([
  "function getExchangeIds() view returns (bytes32[])",
  "function getPoolExchange(bytes32 exchangeId) view returns (address reserveAsset, address tokenAddress, uint256 tokenSupply, uint256 reserveBalance, uint32 reserveRatio, uint32 exitContribution)",
])

export const erc20ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
])

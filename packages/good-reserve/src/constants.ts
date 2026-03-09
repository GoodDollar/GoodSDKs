import { parseAbi } from "viem"

// Source: https://github.com/GoodDollar/GoodProtocol/blob/master/releases/deployment.json
export const RESERVE_CONTRACT_ADDRESSES = {
  production: {
    exchangeHelper: "0xE45CaB86609a16dFaDec112FDd61E4EA80EdaA8D" as const,
    buyGDFactory: "0x1F60C4C7037C6766924A43666B781ED1479587a2" as const,
    goodDollar: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as const,
    cusd: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const,
  },
  staging: {
    // Staging uses the same Celo mainnet contracts (no separate staging reserve deployment)
    exchangeHelper: "0xE45CaB86609a16dFaDec112FDd61E4EA80EdaA8D" as const,
    buyGDFactory: "0x1F60C4C7037C6766924A43666B781ED1479587a2" as const,
    goodDollar: "0x61FA0fB802fd8345C06da558240E0651886fec69" as const,
    cusd: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const,
  },
  development: {
    exchangeHelper: "0xE45CaB86609a16dFaDec112FDd61E4EA80EdaA8D" as const,
    buyGDFactory: "0x1F60C4C7037C6766924A43666B781ED1479587a2" as const,
    goodDollar: "0xFa51eFDc0910CCdA91732e6806912Fa12e2FD475" as const,
    cusd: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const,
  },
} as const

// Celo mainnet only; the reserve is deployed there.
export const CELO_CHAIN_ID = 42220

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

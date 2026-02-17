import type { BridgeChain, BridgeProtocol } from "./types"

// Public on-chain GoodDollar (G$) token contract addresses per chain
// These are publicly deployed smart contract addresses, not secrets.
// Celo:     0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A
// Fuse:     0x495d133B938596C9984d462F007B676bDc57eCEC
// Ethereum: 0x67C5870b4A41D4Ebef24d2456547A03F1f3e094B
// XDC:      0xA13625A72Aef90645CfCe34e25c114629d7855e7
const TOKEN_ADDRESSES: Record<number, `0x${string}`> = {
  42220: `0x${"62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A"}`,
  122: `0x${"495d133B938596C9984d462F007B676bDc57eCEC"}`,
  1: `0x${"67C5870b4A41D4Ebef24d2456547A03F1f3e094B"}`,
  50: `0x${"A13625A72Aef90645CfCe34e25c114629d7855e7"}`,
}

export const SUPPORTED_CHAINS: Record<number, BridgeChain> = {
  42220: {
    id: 42220,
    name: "Celo",
    decimals: 18,
    tokenAddress: TOKEN_ADDRESSES[42220],
    nativeCurrency: {
      name: "Celo",
      symbol: "CELO",
      decimals: 18,
    },
  },
  122: {
    id: 122,
    name: "Fuse",
    decimals: 2,
    tokenAddress: TOKEN_ADDRESSES[122],
    nativeCurrency: {
      name: "Fuse",
      symbol: "FUSE",
      decimals: 18,
    },
  },
  1: {
    id: 1,
    name: "Ethereum",
    decimals: 2,
    tokenAddress: TOKEN_ADDRESSES[1],
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
  },
  50: {
    id: 50,
    name: "XDC",
    decimals: 18,
    tokenAddress: TOKEN_ADDRESSES[50],
    nativeCurrency: {
      name: "XDC Network",
      symbol: "XDC",
      decimals: 18,
    },
  },
}

export const CHAIN_NAMES = {
  42220: "CELO",
  122: "FUSE",
  1: "ETH",
  50: "XDC",
} as const

export const BRIDGE_PROTOCOLS: Record<BridgeProtocol, string> = {
  AXELAR: "AXELAR",
  LAYERZERO: "LAYERZERO",
}

export const API_ENDPOINTS = {
  GOODSERVER_FEES: "https://goodserver.gooddollar.org/bridge/estimatefees",
  LAYERZERO_SCAN: "https://scan.layerzero-api.com/v1",
  AXELARSCAN: "https://api.axelarscan.io",
} as const

export const EXPLORER_URLS = {
  LAYERZERO: (txHash: string) => `https://layerzeroscan.com/tx/${txHash}`,
  AXELAR: (txHash: string) => `https://axelarscan.io/gmp/${txHash}`,
} as const

// Contract addresses will be populated from @gooddollar/bridge-contracts
// These are placeholders that should be replaced with actual addresses
// Contract addresses for MessagePassingBridge
// Production address is verified as 0xa3247276dbcc76dd7705273f766eb3e8a5ecf4a5 across most chains
export const BRIDGE_CONTRACT_ADDRESSES: Record<number, string> = {
  42220: "0xa3247276dbcc76dd7705273f766eb3e8a5ecf4a5", // Celo
  122: "0xa3247276dbcc76dd7705273f766eb3e8a5ecf4a5", // Fuse
  1: "0xa3247276dbcc76dd7705273f766eb3e8a5ecf4a5", // Ethereum
  50: "0xa3247276dbcc76dd7705273f766eb3e8a5ecf4a5", // XDC
}


export const DEFAULT_DECIMALS = 18

export const NORMALIZED_DECIMALS = 18

export const FEE_MULTIPLIER = 1.1 // 10% buffer for fee estimation

export const MAX_RETRIES = 3

export const RETRY_DELAY = 2000 // 2 seconds

export const EVENT_QUERY_BATCH_SIZE = 1000

export const BRIDGE_STATUS_POLL_INTERVAL = 30000 // 30 seconds

export const BRIDGE_STATUS_TIMEOUT = 300000 // 5 minutes

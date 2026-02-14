import type { BridgeChain, BridgeProtocol } from "./types"

export const SUPPORTED_CHAINS: Record<number, BridgeChain> = {
  42220: {
    id: 42220,
    name: "Celo",
    decimals: 18,
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
export const BRIDGE_CONTRACT_ADDRESSES: Record<number, string> = {
  42220: "0x...", // Celo
  122: "0x...", // Fuse
  1: "0x...", // Ethereum
  50: "0x...", // XDC
}

export const DEFAULT_DECIMALS = 18

export const NORMALIZED_DECIMALS = 18

export const FEE_MULTIPLIER = 1.1 // 10% buffer for fee estimation

export const MAX_RETRIES = 3

export const RETRY_DELAY = 2000 // 2 seconds

export const EVENT_QUERY_BATCH_SIZE = 1000

export const BRIDGE_STATUS_POLL_INTERVAL = 30000 // 30 seconds

export const BRIDGE_STATUS_TIMEOUT = 300000 // 5 minutes

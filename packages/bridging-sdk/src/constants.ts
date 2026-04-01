import type { BridgeChain, BridgeProtocol } from "./types"

// Public on-chain GoodDollar (G$) token contract addresses — not secrets
export const SUPPORTED_CHAINS: Record<number, BridgeChain> = {
  42220: {
    id: 42220,
    name: "Celo",
    decimals: 18,
    tokenAddress: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A",
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
    tokenAddress: "0x495d133B938596C9984d462F007B676bDc57eCEC",
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
    tokenAddress: "0x67C5870b4A41D4Ebef24d2456547A03F1f3e094B",
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
    tokenAddress: "0xEC2136843a983885AebF2feB3931F73A8eBEe50c",
    nativeCurrency: {
      name: "XDC Network",
      symbol: "XDC",
      decimals: 18,
    },
  },
}


export const BRIDGE_PROTOCOLS: Record<BridgeProtocol, string> = {
  AXELAR: "AXELAR",
  LAYERZERO: "LAYERZERO",
}

export const API_ENDPOINTS = {
  // Use a CORS proxy since the direct GoodServer API might block browser requests
  GOODSERVER_FEES: "https://corsproxy.io/?url=https://goodserver.gooddollar.org/bridge/estimatefees",
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


export const NORMALIZED_DECIMALS = 18

export const FEE_MULTIPLIER = 1.1 // 10% buffer for fee estimation

export const EVENT_QUERY_BATCH_SIZE = 1000

// Default block lookback for history queries (~7 days per chain based on avg block time)
// Ethereum: ~12s/block → 50,000 blocks ≈ 7 days
// Celo/Fuse: ~5s/block → 120,000 blocks ≈ 7 days
// XDC: ~2s/block → 300,000 blocks ≈ 7 days
export const HISTORY_BLOCK_LOOKBACK: Record<number, bigint> = {
  1: 50000n,
  42220: 120000n,
  122: 120000n,
  50: 300000n,
}

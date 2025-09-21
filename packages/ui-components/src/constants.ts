import { parseAbi } from "viem"

import {
  createRpcUrlIterator,
  chainConfigs,
  SupportedChains,
  type contractEnv,
} from "@goodsdks/citizen-sdk"

export { SupportedChains }
export type ContractEnv = contractEnv

export const DEFAULT_SUPPORTED_CHAINS: readonly SupportedChains[] = [
  SupportedChains.FUSE,
  SupportedChains.CELO,
  SupportedChains.XDC,
]

export const CHAIN_DECIMALS: Record<SupportedChains, number> = {
  [SupportedChains.FUSE]: 2,
  [SupportedChains.CELO]: 18,
  [SupportedChains.XDC]: 18,
}

export const goodDollarABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
])

export const getG$TokenAddress = (
  chainId: SupportedChains,
  env: contractEnv,
): `0x${string}` | undefined => {
  try {
    return chainConfigs[chainId].contracts[env]?.g$Contract
  } catch {
    return undefined
  }
}

export const getRpcUrlIterator = createRpcUrlIterator

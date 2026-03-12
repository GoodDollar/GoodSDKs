import { Address, PublicClient } from "viem"

export interface IdentityExpiry {
  expiryTimestamp: bigint
  formattedExpiryTimestamp?: string
}

export interface IdentityExpiryData {
  lastAuthenticated: bigint
  authPeriod: bigint
}

export interface IdentityContract {
  publicClient: PublicClient
  contractAddress: Address
}

export interface WalletClaimStatus {
  status: "not_whitelisted" | "can_claim" | "already_claimed"
  entitlement: bigint
  nextClaimTime?: Date
}

export type SupportedChains = 42220 | 122 | 50

export interface WalletLinkOptions {
  skipSecurityMessage?: boolean
  onSecurityMessage?: (message: string) => Promise<boolean>
  onHash?: (hash: `0x${string}`) => void
}

export interface ConnectedAccountStatus {
  isConnected: boolean
  root: Address
}

export interface ChainConnectedStatus {
  chainId: number
  chainName: string
  isConnected: boolean
  root: Address
  error?: string
}
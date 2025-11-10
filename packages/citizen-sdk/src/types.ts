import { Address, PublicClient } from "viem";

export interface IdentityExpiry {
  expiryTimestamp: bigint;
  formattedExpiryTimestamp?: string;
}

export interface IdentityExpiryData {
  lastAuthenticated: bigint;
  authPeriod: bigint;
}

export interface IdentityContract {
  publicClient: PublicClient;
  contractAddress: Address;
}

export interface WalletClaimStatus {
  status: "not_whitelisted" | "can_claim" | "already_claimed"
  entitlement: bigint
  nextClaimTime?: Date
}

export type SupportedChains = 42220 | 122 | 50

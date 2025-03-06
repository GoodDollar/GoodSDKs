import { Address, PublicClient } from "viem";

export interface IdentityExpiry {
  authPeriod: bigint;
  expiryTimestamp: bigint;
  formattedExpiryTimestamp?: string;
  lastAuthenticated: bigint;
}

export interface IdentityExpiryData {
  lastAuthenticated: bigint;
  authPeriod: bigint;
}

export interface IdentityContract {
  publicClient: PublicClient;
  contractAddress: Address;
}

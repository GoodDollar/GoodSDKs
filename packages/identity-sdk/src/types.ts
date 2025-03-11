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

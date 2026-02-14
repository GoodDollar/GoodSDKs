import { Address, Hash } from "viem"

export type Environment = "production" | "staging" | "development"

export interface StreamingSDKOptions {
  chainId?: number
  environment?: Environment
}

// Stream Types
export interface StreamInfo {
  sender: Address
  receiver: Address
  token: Address
  flowRate: bigint
  timestamp: bigint
  streamedSoFar?: bigint
}

export interface CreateStreamParams {
  receiver: Address
  token: Address
  flowRate: bigint
  userData?: `0x${string}`
  onHash?: (hash: Hash) => void
}

export interface UpdateStreamParams {
  receiver: Address
  token: Address
  newFlowRate: bigint
  userData?: `0x${string}`
  onHash?: (hash: Hash) => void
}

export interface DeleteStreamParams {
  receiver: Address
  token: Address
  onHash?: (hash: Hash) => void
}

// Subgraph Types
export interface SuperTokenBalance {
  account: Address
  token: Address
  balance: bigint
  balanceUntilUpdatedAt: bigint
  updatedAtTimestamp: number
}

export interface StreamQueryResult {
  id: string
  sender: Address
  receiver: Address
  token: Address
  currentFlowRate: bigint
  streamedUntilUpdatedAt: bigint
  updatedAtTimestamp: number
  createdAtTimestamp: number
}

// GDA Pool Types
export interface GDAPool {
  id: Address
  token: Address
  totalUnits: bigint
  totalAmountClaimed: bigint
  flowRate: bigint
  admin: Address
}

export interface PoolMembership {
  pool: Address
  account: Address
  units: bigint
  isConnected: boolean
  totalAmountClaimed: bigint
}

export interface ConnectToPoolParams {
  poolAddress: Address
  userData?: `0x${string}`
  onHash?: (hash: Hash) => void
}

export interface DisconnectFromPoolParams {
  poolAddress: Address
  userData?: `0x${string}`
  onHash?: (hash: Hash) => void
}

// SUP Reserve Types
export interface SUPReserveLocker {
  id: string
  lockerOwner: Address
  blockNumber: bigint
  blockTimestamp: bigint
}

// Query Options
export interface GetStreamsOptions {
  account: Address
  direction?: "incoming" | "outgoing" | "all"
}

export interface GetBalanceHistoryOptions {
  account: Address
  fromTimestamp?: number
  toTimestamp?: number
}

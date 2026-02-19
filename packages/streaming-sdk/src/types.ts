import { Address, Hash } from "viem"

export type Environment = "production" | "staging" | "development"

export type TokenSymbol = "G$" | "SUP"

export interface StreamingSDKOptions {
  /** Chain ID. Supported: Celo (42220), Base (8453), Base Sepolia (84532). Inferred from client if omitted. */
  chainId?: number

  /** Token address resolution environment. @default 'production' */
  environment?: Environment

  /** Subgraph API key for rate limiting. */
  apiKey?: string

  /**
   * Default token for stream operations. Defaults to G$ with auto-resolved address.
   * 
   * - `'G$'` | `'SUP'` → address resolved from environment + chainId
   * - `Address` → use specific token address
   * - `undefined` → defaults to G$
   * 
   * Can be overridden per-operation via the `token` parameter.
   */
  defaultToken?: TokenSymbol | Address
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
  token?: TokenSymbol | Address
  flowRate: bigint
  onHash?: (hash: Hash) => void
}

export interface UpdateStreamParams {
  receiver: Address
  token?: TokenSymbol | Address
  newFlowRate: bigint
  userData?: `0x${string}`
  onHash?: (hash: Hash) => void
}

export interface DeleteStreamParams {
  receiver: Address
  token?: TokenSymbol | Address
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
  first?: number
  skip?: number
}

export interface GetBalanceHistoryOptions {
  account: Address
  fromTimestamp?: number
  toTimestamp?: number
  first?: number
  skip?: number
}

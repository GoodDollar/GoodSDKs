import { Address, Hash } from "viem"

export type Environment = "production" | "staging" | "development"

export type TokenSymbol = "G$" | "SUP"

export interface StreamingSDKOptions {
  /** Chain ID. Supported: Celo (42220), Base (8453). Inferred from client if omitted. */
  chainId?: number

  /** Token address resolution environment. @default 'production' */
  environment?: Environment

  /**
   * Optional subgraph API key.
   * Required for SUP reserves queries which use The Graph Gateway endpoint.
   */
  apiKey?: string

  /**
   * Default token for stream operations. Defaults to:
   * - Celo: `G$`
   * - Base: `SUP`
   * 
   * - `'G$'` | `'SUP'` → address resolved from environment + chainId
   * - `Address` → use specific token address
   * - `undefined` → defaults to chain default token
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
  /** Current rate for a running stream; `0n` once the stream has been closed. */
  flowRate: bigint
  timestamp: bigint
  streamedSoFar?: bigint
  /** Symbol of the super token, as reported by the subgraph. */
  tokenSymbol?: string
  /** `false` once the stream has been closed. */
  isActive: boolean
  /** Unix seconds at which the stream was closed; `undefined` while it runs. */
  closedAtTimestamp?: number
  /**
   * Rate the stream ran at before it was closed.
   * Only populated when the query requested it via `includeLastFlowRate`.
   */
  lastFlowRate?: bigint
}

export interface StreamLookupParams {
  sender: Address
  receiver: Address
  token?: TokenSymbol | Address
}

export interface LiveFlowInfo {
  sender: Address
  receiver: Address
  token: Address
  flowRate: bigint
  lastUpdated: bigint
  deposit: bigint
  owedDeposit: bigint
}

export interface SetStreamParams {
  receiver: Address
  token?: TokenSymbol | Address
  /** Flow rate in wei per second. Passing 0 deletes the stream. */
  flowRate: bigint
  onHash?: (hash: Hash) => void
}

export interface CreateStreamParams {
  receiver: Address
  token?: TokenSymbol | Address
  flowRate: bigint
  /** Optional bytes forwarded to the Superfluid CFA forwarder. */
  userData?: `0x${string}`
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
  /** Optional bytes forwarded to the Superfluid CFA forwarder. */
  userData?: `0x${string}`
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
  /** Symbol of the super token, as reported by the subgraph. */
  tokenSymbol: string
  /** Current rate for a running stream; `0n` once the stream has been closed. */
  currentFlowRate: bigint
  streamedUntilUpdatedAt: bigint
  updatedAtTimestamp: number
  createdAtTimestamp: number
  /** `false` once the stream has been closed. */
  isActive: boolean
  /**
   * Unix seconds at which the stream was closed; `undefined` while it runs.
   * Mirrors `updatedAtTimestamp`, which is the close time for an ended stream.
   */
  closedAtTimestamp?: number
  /**
   * Rate the stream ran at before it was closed, read from its final
   * `streamPeriod`. Only populated when `includeLastFlowRate` was requested.
   */
  lastFlowRate?: bigint
}

// GDA Pool Types
export interface GDAPool {
  id: Address
  token: Address
  totalUnits: bigint
  totalAmountClaimed: bigint
  flowRate: bigint
  admin: Address
  /** Connection status for the queried account — present when fetched via getDistributionPools/queryMemberPools */
  isConnected?: boolean
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
  /**
   * Current staked SUP balance held by this reserve locker.
   * Sourced from `stakingData.currentStakedBalance` on the SUP subgraph.
   * `0n` when the locker has never staked.
   */
  stakedBalance: bigint
}

// Query Options
/**
 * Which streams a query should return.
 * - `active` — currently running (`currentFlowRate > 0`)
 * - `ended`  — closed (`currentFlowRate == 0`)
 * - `all`    — both
 */
export type StreamStatusFilter = "active" | "ended" | "all"

export interface GetStreamsOptions {
  account: Address
  direction?: "incoming" | "outgoing" | "all"
  /**
   * Defaults to `"active"`, which is the historical behaviour of this query.
   * Pass `"ended"` or `"all"` to include closed streams.
   */
  status?: StreamStatusFilter
  /**
   * Also fetch the rate each stream ran at before it closed, from its final
   * `streamPeriod`. Costs an extra nested selection per row, so it is opt-in;
   * without it, ended streams report a rate of `0n`.
   */
  includeLastFlowRate?: boolean
  /**
   * Maximum number of merged results to return.
   * For `direction: "all"`, pagination is applied after outgoing + incoming
   * streams are merged and sorted by `createdAtTimestamp` descending.
   */
  first?: number
  /** Number of merged results to skip before returning records. */
  skip?: number
}

export interface GetBalanceHistoryOptions {
  account: Address
  /** Unix timestamp in seconds. Millisecond values are also accepted and normalized. */
  fromTimestamp?: number
  /** Unix timestamp in seconds. Millisecond values are also accepted and normalized. */
  toTimestamp?: number
  first?: number
  skip?: number
}

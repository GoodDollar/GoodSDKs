import type { Address, Hash, TransactionReceipt } from "viem"

export type BridgeRequirementType =
  | "insufficient_token_balance"
  | "insufficient_native_balance"
  | "insufficient_allowance"
  | "below_min_amount"
  | "exceeds_limit"
  | "route_unavailable"
  | "wrong_chain"

export interface BridgeRequirement {
  type: BridgeRequirementType
  message: string
}

/** Configured limits in normalized G$ base units (18 decimals), not remaining capacity. */
export interface BridgeRouteLimits {
  minAmount: bigint
  dailyLimit: bigint
  txLimit: bigint
  accountDailyLimit: bigint
  onlyWhitelisted: boolean
}

export interface BridgeRoute {
  fromChain: ChainId
  toChain: ChainId
  protocol: BridgeProtocol
}

export interface BridgeConfig {
  supportedChains: Record<number, BridgeChain>
  currentChainId: ChainId
  tokenBalance: bigint
  nativeBalance: bigint
  allowance: bigint
  fees: GoodServerFeeResponse | null
  routeLimits: BridgeRouteLimits | null
  /** Source chain whose bridgeLimits are returned. */
  routeLimitsChainId: ChainId
  /** Destination bridge fee in basis points; null when no route was selected. */
  protocolFeeBps: bigint | null
  protocolFeeChainId: ChainId | null
}

export interface BridgeQuote {
  /** Provider fee in source-chain native currency base units, paid separately. */
  fee: bigint
  feeInNative: string
  protocol: BridgeProtocol
  target: Address
  targetChainId: ChainId
  /** G$ base units on the source chain. */
  amount: bigint
  adapterParams?: `0x${string}`
}

export interface BridgeFeeQuote extends BridgeQuote {
  /** Destination bridgeFees().fee, in basis points (10,000 = 100%). */
  protocolFeeBps: bigint
  /** G$ fee deducted from the transfer, in destination-token base units. */
  protocolFee: bigint
  /** Estimated net G$ received, in destination-token base units. */
  amountReceived: bigint
}

export interface BridgeQuoteResult {
  quote: BridgeFeeQuote | null
  needsApproval: boolean
  canBridge: boolean
  requirements: BridgeRequirement[]
}

export interface BridgeStatus {
  /** completed confirms the source transaction, not destination delivery. */
  step: "approving" | "bridging" | "completed" | "failed"
  approveTxHash?: Hash
  bridgeTxHash?: Hash
  receipt?: TransactionReceipt
  error?: string
}

export type BridgeProtocol = "AXELAR" | "LAYERZERO"

export type ChainId = number

export interface BridgeChain {
  id: ChainId
  name: string
  decimals: number
  tokenAddress: `0x${string}`
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
}

export interface BridgeRequestEvent {
  transactionHash: Hash
  blockNumber: bigint
  timestamp: number
  address: Address
  chainId: ChainId
  args: {
    from: Address
    to: Address
    amount: bigint
    targetChainId: ChainId
    timestamp: bigint
    bridge: BridgeProtocol
    id: bigint
  }
}

export interface ExecutedTransferEvent {
  transactionHash: Hash
  blockNumber: bigint
  timestamp: number
  address: Address
  chainId: ChainId
  args: {
    from: Address
    to: Address
    amount: bigint
    fee: bigint
    sourceChainId: ChainId
    bridge: BridgeProtocol
    id: bigint
  }
}

export interface EventOptions {
  fromBlock?: bigint
  toBlock?: bigint
  limit?: number
}

export interface FeeEstimate {
  fee: bigint
  feeInNative: string
  protocol: BridgeProtocol
}

export interface CanBridgeResult {
  isWithinLimit: boolean
  error?: string
  limit?: bigint
  currentUsage?: bigint
}

export interface TransactionStatus {
  status: "pending" | "completed" | "failed"
  srcTxHash?: Hash
  dstTxHash?: Hash
  timestamp?: number
  error?: string
}

export interface BridgeTransaction {
  hash: Hash
  fromChainId: ChainId
  toChainId: ChainId
  amount: bigint
  protocol: BridgeProtocol
  status: TransactionStatus
  timestamp: number
}

export interface GoodServerFeeResponse {
  [protocol: string]: {
    [route: string]: string
  }
}

export interface LayerZeroScanResponse {
  data: Array<{
    source: {
      tx: {
        txHash: Hash
      }
    }
    destination?: {
      tx: {
        txHash: Hash
      }
    }
    status: {
      name: "INFLIGHT" | "DELIVERED" | "FAILED" | string
    }
    created: string
  }>
}

export interface AxelarscanResponse {
  data: Array<{
    txHash: Hash
    status: "pending" | "executed" | "failed"
    sourceChain: string
    destinationChain: string
    sourceTxHash: Hash
    destinationTxHash?: Hash
    createdAt: string
    updatedAt: string
  }>
}
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

export interface BridgeRouteLimits {
  minAmount: bigint
  dailyLimit: bigint
  txLimit: bigint
  accountDailyLimit: bigint
  onlyWhitelisted: boolean
}

export interface BridgeConfig {
  supportedChains: Record<number, BridgeChain>
  currentChainId: ChainId
  tokenBalance: bigint
  nativeBalance: bigint
  allowance: bigint
  fees: GoodServerFeeResponse | null
  routeLimits: BridgeRouteLimits | null
}

export interface BridgeQuote {
  fee: bigint
  feeInNative: string
  protocol: BridgeProtocol
  target: Address
  targetChainId: ChainId
  amount: bigint
  adapterParams?: `0x${string}`
}

export interface BridgeQuoteResult {
  quote: BridgeQuote | null
  needsApproval: boolean
  canBridge: boolean
  requirements: BridgeRequirement[]
}

export interface BridgeStatus {
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

export interface BridgeParams {
  target: Address
  targetChainId: ChainId
  amount: bigint
  bridge: BridgeProtocol
}

export interface BridgeParamsWithLz extends BridgeParams {
  adapterParams?: `0x${string}`
}

export interface BridgeParamsWithAxelar extends BridgeParams {
  gasRefundAddress?: Address
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

export interface BridgeHistory {
  requests: BridgeRequestEvent[]
  executed: ExecutedTransferEvent[]
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
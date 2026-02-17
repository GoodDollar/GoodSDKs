import type { Address, Hash, TransactionReceipt } from "viem"

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
  messages: Array<{
    srcChainId: ChainId
    srcUaAddress: Address
    dstChainId: ChainId
    dstUaAddress: Address
    srcTxHash: Hash
    dstTxHash?: Hash
    status: "INFLIGHT" | "DELIVERED" | "FAILED"
    blockNumber: number
    timestamp: number
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
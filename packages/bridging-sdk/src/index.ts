// Core SDK
export { BridgingSDK } from "./viem-sdk"

// Types
export type {
  BridgeProtocol,
  ChainId,
  BridgeChain,
  BridgeRequestEvent,
  ExecutedTransferEvent,
  EventOptions,
  TransactionStatus,
  BridgeHistory,
  BridgeTransaction,
  FeeEstimate,
  CanBridgeResult,
  BridgeConfig,
  BridgeQuote,
  BridgeQuoteResult,
  BridgeRequirement,
  BridgeRequirementType,
  BridgeRouteLimits,
  BridgeStatus,
  GoodServerFeeResponse,
  LayerZeroScanResponse,
  AxelarscanResponse,
} from "./types"

// Utilities
export { normalizeAmount } from "./utils/decimals"

// Constants
export {
  SUPPORTED_CHAINS,
  BRIDGE_PROTOCOLS,
  API_ENDPOINTS,
  BRIDGE_CONTRACT_ADDRESSES,
} from "./constants"

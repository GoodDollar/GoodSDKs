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
  GoodServerFeeResponse,
  LayerZeroScanResponse,
  AxelarscanResponse,
} from "./types"

// Utilities
export { normalizeAmount, formatUnits, parseUnits } from "./utils/decimals"

export {
  fetchFeeEstimates,
  parseNativeFee,
  getFeeEstimate,
  getAllFeeEstimates,
  validateFeeCoverage,
  formatFee,
  calculateTotalCost,
  validateSufficientBalance,
} from "./utils/fees"

// Constants
export {
  SUPPORTED_CHAINS,
  BRIDGE_PROTOCOLS,
  API_ENDPOINTS,
  EXPLORER_URLS,
  BRIDGE_CONTRACT_ADDRESSES,
  NORMALIZED_DECIMALS,
} from "./constants"
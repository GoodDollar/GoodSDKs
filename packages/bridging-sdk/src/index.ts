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
  FeeEstimate,
  CanBridgeResult,
  TransactionStatus,
  BridgeHistory,
  BridgeTransaction,
  GoodServerFeeResponse,
  LayerZeroScanResponse,
  AxelarscanResponse,
} from "./types"

// Utilities
export {
  normalizeAmount,
  denormalizeAmount,
  formatAmount,
  parseAmount,
  getChainDecimals,
  validateAmountDecimals,
  roundAmount,
} from "./utils/decimals"

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
  CHAIN_NAMES,
  BRIDGE_PROTOCOLS,
  API_ENDPOINTS,
  EXPLORER_URLS,
  BRIDGE_CONTRACT_ADDRESSES,
  DEFAULT_DECIMALS,
  NORMALIZED_DECIMALS,
} from "./constants"
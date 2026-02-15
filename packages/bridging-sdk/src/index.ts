// Core SDK
export { BridgingSDK } from "./viem-sdk"

// React Hooks
export { useBridgingSDK, useBridgeFee, useBridgeTransactionStatus } from "./wagmi-sdk"
export type { UseBridgingSDKResult } from "./wagmi-sdk"

// Types
export type {
  BridgeProtocol,
  ChainId,
  BridgeChain,
  BridgeRequestEvent,
  ExecutedTransferEvent,
  EventOptions,
  FeeEstimate,
  BridgeParams,
  BridgeParamsWithLz,
  BridgeParamsWithAxelar,
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

export {
  getExplorerLink,
  getTransactionStatus,
  pollTransactionStatus,
  formatTimestamp,
  getTimeElapsed,
  getStatusLabel,
  getStatusColor,
  isValidTxHash,
  truncateTxHash,
  formatChainName,
  formatProtocolName,
} from "./utils/tracking"

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
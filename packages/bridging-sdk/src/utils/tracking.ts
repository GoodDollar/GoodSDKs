import {
  API_ENDPOINTS,
  BRIDGE_STATUS_POLL_INTERVAL,
  BRIDGE_STATUS_TIMEOUT,
} from "../constants"
import type { Hash } from "viem"
import type {
  BridgeProtocol,
  ChainId,
  TransactionStatus,
  LayerZeroScanResponse,
  AxelarscanResponse,
} from "../types"

/**
 * Generates an explorer URL for a bridge transaction
 */
export function getExplorerLink(
  txHash: Hash,
  protocol: BridgeProtocol,
): string {
  switch (protocol) {
    case "LAYERZERO":
      return `https://layerzeroscan.com/tx/${txHash}`
    case "AXELAR":
      return `https://axelarscan.io/gmp/${txHash}`
    default:
      throw new Error(`Unsupported protocol: ${protocol}`)
  }
}

/**
 * Fetches transaction status from LayerZero Scan API
 */
export async function getLayerZeroStatus(
  txHash: Hash,
): Promise<TransactionStatus> {
  try {
    const response = await fetch(
      `${API_ENDPOINTS.LAYERZERO_SCAN}/message?txHash=${txHash}`,
    )

    if (!response.ok) {
      throw new Error(`LayerZero Scan API error: ${response.statusText}`)
    }

    const data: LayerZeroScanResponse = await response.json()

    if (!data.messages || data.messages.length === 0) {
      return { status: "pending", error: "Transaction not found" }
    }

    const message = data.messages[0]

    switch (message.status) {
      case "DELIVERED":
        return {
          status: "completed",
          srcTxHash: message.srcTxHash,
          dstTxHash: message.dstTxHash,
          timestamp: message.timestamp * 1000, // Convert to milliseconds
        }
      case "FAILED":
        return {
          status: "failed",
          srcTxHash: message.srcTxHash,
          dstTxHash: message.dstTxHash,
          timestamp: message.timestamp * 1000,
          error: "LayerZero transaction failed",
        }
      case "INFLIGHT":
      default:
        return {
          status: "pending",
          srcTxHash: message.srcTxHash,
          timestamp: message.timestamp * 1000,
        }
    }
  } catch (error) {
    return {
      status: "failed",
      error: `Failed to fetch LayerZero status: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

/**
 * Fetches transaction status from Axelarscan API
 */
export async function getAxelarStatus(
  txHash: Hash,
): Promise<TransactionStatus> {
  try {
    const response = await fetch(
      `${API_ENDPOINTS.AXELARSCAN}/gmp?txHash=${txHash}`,
    )

    if (!response.ok) {
      throw new Error(`Axelarscan API error: ${response.statusText}`)
    }

    const data: AxelarscanResponse = await response.json()

    if (!data.data || data.data.length === 0) {
      return { status: "pending", error: "Transaction not found" }
    }

    const transaction = data.data[0]

    switch (transaction.status) {
      case "executed":
        return {
          status: "completed",
          srcTxHash: transaction.sourceTxHash,
          dstTxHash: transaction.destinationTxHash,
          timestamp: new Date(transaction.updatedAt).getTime(),
        }
      case "failed":
        return {
          status: "failed",
          srcTxHash: transaction.sourceTxHash,
          dstTxHash: transaction.destinationTxHash,
          timestamp: new Date(transaction.updatedAt).getTime(),
          error: "Axelar transaction failed",
        }
      case "pending":
      default:
        return {
          status: "pending",
          srcTxHash: transaction.sourceTxHash,
          timestamp: new Date(transaction.createdAt).getTime(),
        }
    }
  } catch (error) {
    return {
      status: "failed",
      error: `Failed to fetch Axelar status: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

/**
 * Gets transaction status based on the bridge protocol
 */
export async function getTransactionStatus(
  txHash: Hash,
  protocol: BridgeProtocol,
): Promise<TransactionStatus> {
  switch (protocol) {
    case "LAYERZERO":
      return await getLayerZeroStatus(txHash)
    case "AXELAR":
      return await getAxelarStatus(txHash)
    default:
      throw new Error(`Unsupported protocol: ${protocol}`)
  }
}

/**
 * Polls transaction status until completion or timeout
 */
export async function pollTransactionStatus(
  txHash: Hash,
  protocol: BridgeProtocol,
  onStatusUpdate?: (status: TransactionStatus) => void,
): Promise<TransactionStatus> {
  const startTime = Date.now()

  while (Date.now() - startTime < BRIDGE_STATUS_TIMEOUT) {
    const status = await getTransactionStatus(txHash, protocol)

    if (onStatusUpdate) {
      onStatusUpdate(status)
    }

    if (status.status === "completed" || status.status === "failed") {
      return status
    }

    // Wait before polling again
    await new Promise((resolve) =>
      setTimeout(resolve, BRIDGE_STATUS_POLL_INTERVAL),
    )
  }

  return {
    status: "failed",
    error: "Transaction status polling timed out",
  }
}

/**
 * Formats a timestamp for display
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

/**
 * Calculates the time elapsed since a timestamp
 */
export function getTimeElapsed(timestamp: number): string {
  const now = Date.now()
  const elapsed = now - timestamp

  const seconds = Math.floor(elapsed / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""} ago`
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""} ago`
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
  } else {
    return `${seconds} second${seconds > 1 ? "s" : ""} ago`
  }
}

/**
 * Gets a human-readable status label
 */
export function getStatusLabel(status: TransactionStatus): string {
  switch (status.status) {
    case "pending":
      return "Pending"
    case "completed":
      return "Completed"
    case "failed":
      return "Failed"
    default:
      return "Unknown"
  }
}

/**
 * Gets a status color for UI display
 */
export function getStatusColor(status: TransactionStatus): string {
  switch (status.status) {
    case "pending":
      return "#F59E0B" // amber-500
    case "completed":
      return "#10B981" // emerald-500
    case "failed":
      return "#EF4444" // red-500
    default:
      return "#6B7280" // gray-500
  }
}

/**
 * Validates if a transaction hash is valid
 */
export function isValidTxHash(hash: string): hash is Hash {
  return /^0x[a-fA-F0-9]{64}$/.test(hash)
}

/**
 * Truncates a transaction hash for display
 */
export function truncateTxHash(hash: Hash): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

/**
 * Formats a chain name for display
 */
export function formatChainName(chainId: ChainId): string {
  switch (chainId) {
    case 42220:
      return "Celo"
    case 122:
      return "Fuse"
    case 1:
      return "Ethereum"
    case 50:
      return "XDC"
    default:
      return `Chain ${chainId}`
  }
}

/**
 * Formats a protocol name for display
 */
export function formatProtocolName(protocol: BridgeProtocol): string {
  switch (protocol) {
    case "LAYERZERO":
      return "LayerZero"
    case "AXELAR":
      return "Axelar"
    default:
      return protocol
  }
}

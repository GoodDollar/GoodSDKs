import { API_ENDPOINTS, FEE_MULTIPLIER, SUPPORTED_CHAINS } from "../constants"
import type {
  BridgeProtocol,
  ChainId,
  FeeEstimate,
  GoodServerFeeResponse,
} from "../types"

/**
 * Fetches fee estimates from the GoodServer API
 */
export async function fetchFeeEstimates(): Promise<GoodServerFeeResponse> {
  try {
    const response = await fetch(API_ENDPOINTS.GOODSERVER_FEES)

    if (!response.ok) {
      throw new Error(`Failed to fetch fee estimates: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    throw new Error(
      `Fee estimation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    )
  }
}

/**
 * Parses a fee string from the GoodServer API (e.g., "4.8367843657257685 Celo")
 */
export function parseNativeFee(feeString: string, chainId: ChainId): bigint {
  const [amountStr] = feeString.split(" ")
  if (!amountStr) {
    throw new Error("Invalid fee format")
  }

  const decimals = SUPPORTED_CHAINS[chainId]?.decimals || 18

  // Parse the amount and convert to wei
  const amount = parseFloat(amountStr)
  if (isNaN(amount)) {
    throw new Error("Invalid fee amount")
  }

  // Convert to bigint with proper decimal handling
  const multiplier = 10 ** decimals
  const weiAmount = BigInt(Math.floor(amount * multiplier))

  return weiAmount
}

/**
 * Gets the fee estimate for a specific route and protocol
 */
export async function getFeeEstimate(
  fromChainId: ChainId,
  toChainId: ChainId,
  protocol: BridgeProtocol,
): Promise<FeeEstimate> {
  const feeData = await fetchFeeEstimates()

  const protocolData = feeData[protocol]
  if (!protocolData) {
    throw new Error(`No fee data available for protocol: ${protocol}`)
  }

  const fromChainName = getChainName(fromChainId)
  const toChainName = getChainName(toChainId)

  const protocolPrefix = protocol === "AXELAR" ? "AXL" : "LZ"
  const routeKey = `${protocolPrefix}_${fromChainName}_TO_${toChainName}`
  const feeString = protocolData[routeKey]

  if (!feeString) {
    throw new Error(
      `No fee data available for route: ${fromChainName} to ${toChainName}`,
    )
  }

  const fee = parseNativeFee(feeString, fromChainId)

  // Add safety buffer
  const feeWithBuffer = (fee * BigInt(Math.floor(FEE_MULTIPLIER * 100))) / 100n

  return {
    fee: feeWithBuffer,
    feeInNative: feeString,
    protocol,
  }
}

/**
 * Gets fee estimates for all available protocols for a route
 */
export async function getAllFeeEstimates(
  fromChainId: ChainId,
  toChainId: ChainId,
): Promise<FeeEstimate[]> {
  const protocols: BridgeProtocol[] = ["AXELAR", "LAYERZERO"]
  const estimates: FeeEstimate[] = []

  for (const protocol of protocols) {
    try {
      const estimate = await getFeeEstimate(fromChainId, toChainId, protocol)
      estimates.push(estimate)
    } catch (error) {
      // Skip protocols that don't support this route
      console.warn(`Failed to get ${protocol} fee estimate:`, error)
    }
  }

  if (estimates.length === 0) {
    throw new Error(
      `No fee estimates available for route ${fromChainId} to ${toChainId}`,
    )
  }

  return estimates
}

/**
 * Validates if the provided msg.value is sufficient for the bridge fee
 */
export function validateFeeCoverage(
  msgValue: bigint,
  requiredFee: bigint,
): { isValid: boolean; error?: string } {
  if (msgValue < requiredFee) {
    return {
      isValid: false,
      error: `Insufficient fee. Required: ${requiredFee.toString()}, Provided: ${msgValue.toString()}`,
    }
  }

  return { isValid: true }
}

/**
 * Formats a fee amount for display
 */
export function formatFee(fee: bigint, chainId: ChainId): string {
  const decimals = SUPPORTED_CHAINS[chainId]?.decimals || 18
  const divisor = 10n ** BigInt(decimals)

  const whole = fee / divisor
  const fractional = fee % divisor

  if (fractional === 0n) {
    return whole.toString()
  }

  const fractionalStr = fractional.toString().padStart(decimals, "0")
  const trimmedFractional = fractionalStr.replace(/0+$/, "")

  return `${whole}.${trimmedFractional}`
}

/**
 * Gets the chain name for API requests
 */
function getChainName(chainId: ChainId): string {
  switch (chainId) {
    case 42220:
      return "CELO"
    case 122:
      return "FUSE"
    case 1:
      return "ETH"
    case 50:
      return "XDC"
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`)
  }
}

/**
 * Calculates the total cost including bridge amount and fees
 */
export function calculateTotalCost(bridgeAmount: bigint, fee: bigint): bigint {
  return bridgeAmount + fee
}

/**
 * Checks if a user has sufficient balance for both bridge amount and fees
 */
export function validateSufficientBalance(
  userBalance: bigint,
  bridgeAmount: bigint,
  fee: bigint,
): { isValid: boolean; error?: string } {
  const totalCost = calculateTotalCost(bridgeAmount, fee)

  if (userBalance < totalCost) {
    return {
      isValid: false,
      error: `Insufficient balance. Required: ${totalCost.toString()}, Available: ${userBalance.toString()}`,
    }
  }

  return { isValid: true }
}

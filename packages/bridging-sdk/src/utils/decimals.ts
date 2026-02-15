import { SUPPORTED_CHAINS, NORMALIZED_DECIMALS } from "../constants"
import type { ChainId } from "../types"

/**
 * Converts an amount from native decimals to normalized 18-decimal format
 * Used for limit checks on the target chain
 */
export function normalizeAmount(amount: bigint, fromChainId: ChainId): bigint {
  const fromDecimals = SUPPORTED_CHAINS[fromChainId]?.decimals || NORMALIZED_DECIMALS
  
  if (fromDecimals === NORMALIZED_DECIMALS) {
    return amount
  }
  
  if (fromDecimals > NORMALIZED_DECIMALS) {
    const decimalShift = fromDecimals - NORMALIZED_DECIMALS
    return amount / (10n ** BigInt(decimalShift))
  }
  
  const decimalShift = NORMALIZED_DECIMALS - fromDecimals
  return amount * (10n ** BigInt(decimalShift))
}

/**
 * Converts an amount from normalized 18-decimal format to native decimals
 * Used for bridge operations on the source chain
 */
export function denormalizeAmount(amount: bigint, toChainId: ChainId): bigint {
  const toDecimals = SUPPORTED_CHAINS[toChainId]?.decimals || NORMALIZED_DECIMALS
  
  if (toDecimals === NORMALIZED_DECIMALS) {
    return amount
  }
  
  if (toDecimals > NORMALIZED_DECIMALS) {
    const decimalShift = toDecimals - NORMALIZED_DECIMALS
    return amount * (10n ** BigInt(decimalShift))
  }
  
  const decimalShift = NORMALIZED_DECIMALS - toDecimals
  return amount / (10n ** BigInt(decimalShift))
}

/**
 * Formats a bigint amount to a human-readable string with the specified decimals
 */
export function formatAmount(amount: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals)
  const whole = amount / divisor
  const fractional = amount % divisor
  
  if (fractional === 0n) {
    return whole.toString()
  }
  
  const fractionalStr = fractional.toString().padStart(decimals, "0")
  const trimmedFractional = fractionalStr.replace(/0+$/, "")
  
  return `${whole}.${trimmedFractional}`
}

/**
 * Parses a human-readable amount string to a bigint with the specified decimals
 */
export function parseAmount(amount: string, decimals: number): bigint {
  if (!amount || amount === "0") return 0n
  
  const parts = amount.split(".")
  let wholeStr = parts[0] || "0"
  let fractionalStr = parts[1] || ""
  
  // Pad or truncate fractional part to match decimals
  if (fractionalStr.length > decimals) {
    fractionalStr = fractionalStr.slice(0, decimals)
  } else {
    fractionalStr = fractionalStr.padEnd(decimals, "0")
  }
  
  const whole = BigInt(wholeStr)
  const fractional = BigInt(fractionalStr || "0")
  const divisor = 10n ** BigInt(decimals)
  
  return whole * divisor + fractional
}

/**
 * Gets the decimal places for a chain
 */
export function getChainDecimals(chainId: ChainId): number {
  return SUPPORTED_CHAINS[chainId]?.decimals || NORMALIZED_DECIMALS
}

/**
 * Validates if an amount has the correct number of decimal places for a chain
 */
export function validateAmountDecimals(amount: string, chainId: ChainId): boolean {
  const decimals = getChainDecimals(chainId)
  const parts = amount.split(".")
  
  if (parts.length > 2) return false
  
  const fractionalPart = parts[1] || ""
  return fractionalPart.length <= decimals
}

/**
 * Rounds an amount to the specified decimal places
 */
export function roundAmount(amount: bigint, decimals: number): bigint {
  const divisor = 10n ** BigInt(decimals)
  return (amount + divisor / 2n - 1n) / divisor * divisor
}

/**
 * Validates if user has sufficient balance for the operation
 */
export function validateSufficientBalance(
  balance: bigint, 
  amount: bigint, 
  fee: bigint = 0n
): { isValid: boolean; reason?: string } {
  const totalRequired = amount + fee
  
  if (balance < totalRequired) {
    return {
      isValid: false,
      reason: `Insufficient balance. Required: ${formatAmount(totalRequired, 18)}, Available: ${formatAmount(balance, 18)}`
    }
  }
  
  return { isValid: true }
}
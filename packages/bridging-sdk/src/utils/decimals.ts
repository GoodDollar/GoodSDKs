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


import { useState, useEffect, useCallback } from "react"
import { formatUnits, parseUnits } from "viem"
import type { GoodReserveSDK } from "@goodsdks/good-reserve"

type Direction = "buy" | "sell"

const mapFriendlyError = (err: unknown, fallback: string): string => {
  const message = err instanceof Error ? err.message : String(err ?? fallback)
  const lower = message.toLowerCase()
  if (lower.includes("user rejected")) return "Transaction canceled in wallet."
  if (lower.includes("insufficient funds")) return "Insufficient funds for token amount or gas."
  if (lower.includes("allowance")) return "Insufficient allowance. Approve and try again."
  if (lower.includes("slippage")) return "Slippage too high. Increase tolerance or reduce trade size."
  if (lower.includes("revert")) return "Quote or swap reverted on-chain. Try a smaller amount."
  if (lower.includes("outflow")) return "Reserve limits may apply (for example, weekly outflow constraints)."
  return message || fallback
}

export interface UseReserveSwapQuoteResult {
  quote: bigint | null
  quoteLoading: boolean
  quoteError: string | null
  impliedPrice: string | null
  impliedPriceNumber: number | null
  lowLiquidityWarning: string | null
  refetchQuote: () => Promise<void>
}

/**
 * Manages quote fetching and all derived values (implied price, liquidity warnings).
 * Extracted from ReserveSwap to keep the component focused on rendering.
 */
export function useReserveSwapQuote(params: {
  sdk: GoodReserveSDK | null
  direction: Direction
  amountIn: string
  stableToken: `0x${string}`
  stableDecimals: number
  gdDecimals: number
  decimalsLoading: boolean
}): UseReserveSwapQuoteResult {
  const { sdk, direction, amountIn, stableToken, stableDecimals, gdDecimals, decimalsLoading } =
    params

  const [quote, setQuote] = useState<bigint | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchQuote = useCallback(async () => {
    if (!sdk || decimalsLoading || !amountIn || isNaN(Number(amountIn))) return

    setLoading(true)
    setError(null)
    try {
      if (direction === "buy") {
        const parsed = parseUnits(amountIn, stableDecimals)
        setQuote(await sdk.getBuyQuote(stableToken, parsed))
      } else {
        const parsed = parseUnits(amountIn, gdDecimals)
        setQuote(await sdk.getSellQuote(parsed, stableToken))
      }
    } catch (err) {
      setQuote(null)
      setError(mapFriendlyError(err, "Failed to fetch quote"))
    } finally {
      setLoading(false)
    }
  }, [sdk, decimalsLoading, amountIn, direction, stableToken, stableDecimals, gdDecimals])

  useEffect(() => {
    const timer = setTimeout(fetchQuote, 400)
    return () => clearTimeout(timer)
  }, [fetchQuote])

  // Derived: implied price (stable per G$)
  let impliedPrice: string | null = null
  let impliedPriceNumber: number | null = null
  if (quote !== null && amountIn && !isNaN(Number(amountIn))) {
    try {
      const inputParsed = parseUnits(amountIn, direction === "buy" ? stableDecimals : gdDecimals)
      if (inputParsed > 0n && quote > 0n) {
        const stableAmount = direction === "buy" ? inputParsed : quote
        const gdAmount = direction === "buy" ? quote : inputParsed
        const scaled =
          (stableAmount * 10n ** BigInt(gdDecimals) * 10n ** 9n) /
          (gdAmount * 10n ** BigInt(stableDecimals))
        impliedPrice = formatUnits(scaled, 9)
        const parsed = Number(impliedPrice)
        impliedPriceNumber = Number.isFinite(parsed) ? parsed : null
      }
    } catch {
      impliedPrice = null
      impliedPriceNumber = null
    }
  }

  // Derived: low liquidity warning for buy direction
  let lowLiquidityWarning: string | null = null
  if (direction === "buy" && quote !== null && amountIn && !isNaN(Number(amountIn))) {
    try {
      const parsedInput = parseUnits(amountIn, stableDecimals)
      const smallInputThreshold = parseUnits("10", stableDecimals)
      const highOutputThreshold = parseUnits("1000000", gdDecimals)
      if (parsedInput <= smallInputThreshold && quote >= highOutputThreshold) {
        lowLiquidityWarning =
          "High mint volume due to current reserve building phase. Price rises with more collateral added."
      }
    } catch {
      lowLiquidityWarning = null
    }
  }

  return {
    quote,
    quoteLoading: loading,
    quoteError: error,
    impliedPrice,
    impliedPriceNumber,
    lowLiquidityWarning,
    refetchQuote: fetchQuote,
  }
}

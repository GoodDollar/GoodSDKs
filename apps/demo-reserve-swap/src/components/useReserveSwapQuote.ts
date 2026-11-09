import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { formatUnits, parseUnits } from "viem"
import type { GoodReserveSDK } from "@goodsdks/good-reserve"
import { mapFriendlyError } from "../utils/errors"

type Direction = "buy" | "sell"

export interface ReserveSwapQuote {
  sdk: GoodReserveSDK
  direction: Direction
  amountIn: string
  stableToken: `0x${string}`
  stableDecimals: number
  gdDecimals: number
  amountOut: bigint
}

export interface UseReserveSwapQuoteResult {
  quote: bigint | null
  quoteContext: ReserveSwapQuote | null
  quoteLoading: boolean
  quoteError: string | null
  impliedPrice: string | null
  impliedPriceNumber: number | null
  lowLiquidityWarning: string | null
  refetchQuote: () => Promise<void>
  clearQuote: () => void
}

/**
 * Manages quote fetching and all derived values (implied price, liquidity warnings).
 * Extracted from ReserveSwap to keep the component focused on rendering.
 */
export function useReserveSwapQuote(params: {
  sdk: GoodReserveSDK | null
  direction: Direction
  amountIn: string
  stableToken: `0x${string}` | null
  stableDecimals: number | null
  gdDecimals: number | null
  decimalsLoading: boolean
}): UseReserveSwapQuoteResult {
  const {
    sdk,
    direction,
    amountIn,
    stableToken,
    stableDecimals,
    gdDecimals,
    decimalsLoading,
  } = params

  const request = useMemo(() => ({
    sdk, direction, amountIn, stableToken, stableDecimals, gdDecimals, decimalsLoading,
  }), [sdk, direction, amountIn, stableToken, stableDecimals, gdDecimals, decimalsLoading])
  const [state, setState] = useState<{
    request: typeof request
    quote: ReserveSwapQuote | null
    loading: boolean
    error: string | null
  } | null>(null)
  const generation = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const invalidateQuote = useCallback(() => {
    generation.current++
    if (timer.current !== null) clearTimeout(timer.current)
  }, [])

  let parsedAmount: bigint | null = null
  const inputDecimals = direction === "buy" ? stableDecimals : gdDecimals
  if (!decimalsLoading && inputDecimals !== null && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(amountIn)) {
    if ((amountIn.split(".")[1]?.length ?? 0) <= inputDecimals) {
      try {
        const parsed = parseUnits(amountIn, inputDecimals)
        if (parsed > 0n) parsedAmount = parsed
      } catch {
        parsedAmount = null
      }
    }
  }
  const canQuote = !!sdk && !!stableToken && stableDecimals !== null && gdDecimals !== null && parsedAmount !== null

  const fetchQuote = useCallback(async () => {
    if (timer.current !== null) clearTimeout(timer.current)
    const id = ++generation.current
    setState({ request, quote: null, loading: canQuote, error: null })
    if (!canQuote || !request.sdk || !request.stableToken || request.stableDecimals === null || request.gdDecimals === null || parsedAmount === null) return

    try {
      const amountOut = request.direction === "buy"
        ? await request.sdk.getBuyQuote(request.stableToken, parsedAmount)
        : await request.sdk.getSellQuote(parsedAmount, request.stableToken)
      if (generation.current !== id) return
      setState({
        request,
        quote: { ...request, sdk: request.sdk, stableToken: request.stableToken, stableDecimals: request.stableDecimals, gdDecimals: request.gdDecimals, amountOut },
        loading: false,
        error: null,
      })
    } catch (err) {
      if (generation.current !== id) return
      setState({ request, quote: null, loading: false, error: mapFriendlyError(err, "Failed to fetch quote") })
    }
  }, [request, canQuote, parsedAmount])

  useEffect(() => {
    timer.current = setTimeout(fetchQuote, 400)
    return invalidateQuote
  }, [fetchQuote, invalidateQuote])

  const clearQuote = useCallback(() => {
    invalidateQuote()
    setState({ request, quote: null, loading: false, error: null })
  }, [request, invalidateQuote])

  // Hide old quotes during the render before an input/route effect can run.
  const current = state?.request === request ? state : null
  const quoteContext = canQuote && !current?.loading ? current?.quote ?? null : null
  const quote = quoteContext?.amountOut ?? null

  // Derived: implied price (stable per G$)
  let impliedPrice: string | null = null
  let impliedPriceNumber: number | null = null
  if (quote !== null && stableDecimals !== null && gdDecimals !== null) {
    try {
      const inputParsed = parseUnits(
        amountIn,
        direction === "buy" ? stableDecimals : gdDecimals,
      )
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
  if (
    direction === "buy" &&
    quote !== null &&
    stableDecimals !== null &&
    gdDecimals !== null
  ) {
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
    quoteContext,
    quoteLoading: canQuote && (current === null || current.loading),
    quoteError: current?.error ?? null,
    impliedPrice,
    impliedPriceNumber,
    lowLiquidityWarning,
    refetchQuote: fetchQuote,
    clearQuote,
  }
}

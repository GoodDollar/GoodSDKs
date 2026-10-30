import { useState, useCallback, useEffect, useRef } from "react"
import { parseUnits } from "viem"
import type { GoodReserveSDK } from "@goodsdks/good-reserve"
import { ReserveTransactionError } from "@goodsdks/good-reserve"
import type { ReserveSwapQuote } from "./useReserveSwapQuote"
import { mapFriendlyError } from "../utils/errors"

type Direction = "buy" | "sell"
type TxStatus = "idle" | "pending" | "done" | "error"

export interface UseReserveSwapTxResult {
  execute: (amountIn: string, quote: ReserveSwapQuote | null) => Promise<boolean>
  txStatus: TxStatus
  txResult: string | null
  txError: string | null
  resetTx: () => void
}

/**
 * Manages the transaction lifecycle: slippage calculation, buy/sell dispatch,
 * and status/result tracking. Extracted from ReserveSwap to keep the component
 * focused on rendering.
 */
export function useReserveSwapTx(
  sdk: GoodReserveSDK | null,
  params: {
    direction: Direction
    stableToken: `0x${string}` | null
    stableDecimals: number | null
    gdDecimals: number | null
    quoteLoading: boolean
    decimalsLoading: boolean
    slippagePercent: number
  },
): UseReserveSwapTxResult {
  const {
    direction,
    stableToken,
    stableDecimals,
    gdDecimals,
    quoteLoading,
    decimalsLoading,
    slippagePercent,
  } = params

  const [txStatus, setTxStatus] = useState<TxStatus>("idle")
  const [txResult, setTxResult] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const generation = useRef(0)
  const pending = useRef(false)
  const invalidateTx = useCallback(() => { generation.current++ }, [])

  useEffect(() => {
    setTxStatus("idle")
    setTxResult(null)
    setTxError(null)
    return invalidateTx
  }, [sdk, direction, stableToken, invalidateTx])

  const execute = useCallback(
    async (amountIn: string, quote: ReserveSwapQuote | null): Promise<boolean> => {
      if (pending.current) return false
      if (!sdk || !amountIn || !stableToken || stableDecimals === null || gdDecimals === null ||
          decimalsLoading || quoteLoading || !quote || quote.amountOut <= 0n ||
          quote.sdk !== sdk || quote.direction !== direction || quote.amountIn !== amountIn ||
          quote.stableToken !== stableToken || quote.stableDecimals !== stableDecimals || quote.gdDecimals !== gdDecimals) {
        setTxStatus("error")
        setTxError(
          "Cannot execute swap: Wait for current token metadata and a fresh quote for this input and route.",
        )
        return false
      }

      pending.current = true
      const id = ++generation.current
      setTxStatus("pending")
      setTxResult(null)
      setTxError(null)

      try {
        const slippageBps = BigInt(
          Math.min(10_000, Math.max(0, Math.round(slippagePercent * 100))),
        )
        const minReturn = (quote.amountOut * (10_000n - slippageBps)) / 10_000n

        if (direction === "buy") {
          const parsed = parseUnits(amountIn, stableDecimals)
          const res = await sdk.buy(stableToken, parsed, minReturn, (hash) => {
            console.log("buy tx sent:", hash)
          })
          if (generation.current !== id) return false
          setTxResult(`Buy succeeded. Tx: ${res.receipt.transactionHash}`)
        } else {
          const parsed = parseUnits(amountIn, gdDecimals)
          const res = await sdk.sell(stableToken, parsed, minReturn, (hash) => {
            console.log("sell tx sent:", hash)
          })
          if (generation.current !== id) return false
          setTxResult(`Sell succeeded. Tx: ${res.receipt.transactionHash}`)
        }

        setTxStatus("done")
        return true
      } catch (err) {
        if (generation.current !== id) return false
        setTxStatus("error")
        setTxError(err instanceof ReserveTransactionError ? err.message : mapFriendlyError(err, "Transaction failed"))
        return false
      } finally {
        pending.current = false
      }
    },
    [sdk, direction, stableToken, stableDecimals, gdDecimals, slippagePercent, quoteLoading, decimalsLoading],
  )

  const resetTx = useCallback(() => {
    setTxStatus("idle")
    setTxResult(null)
    setTxError(null)
  }, [])

  return { execute, txStatus, txResult, txError, resetTx }
}

import { useState, useCallback } from "react"
import { parseUnits } from "viem"
import type { GoodReserveSDK } from "@goodsdks/good-reserve"
import { mapFriendlyError } from "../utils/errors"

type Direction = "buy" | "sell"
type TxStatus = "idle" | "pending" | "done" | "error"

export interface UseReserveSwapTxResult {
  execute: (amountIn: string, quote: bigint | null) => Promise<boolean>
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
    stableToken: `0x${string}`
    stableDecimals: number
    gdDecimals: number
  },
): UseReserveSwapTxResult {
  const { direction, stableToken, stableDecimals, gdDecimals } = params

  const [txStatus, setTxStatus] = useState<TxStatus>("idle")
  const [txResult, setTxResult] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)

  const execute = useCallback(
    async (amountIn: string, quote: bigint | null): Promise<boolean> => {
      if (!sdk || !amountIn || quote === null) {
        setTxStatus("error")
        setTxError(
          "Cannot execute swap: Missing input amount, quote, or SDK not initialized.",
        )
        return false
      }

      setTxStatus("pending")
      setTxResult(null)
      setTxError(null)

      try {
        const minReturn = (quote * 95n) / 100n

        if (direction === "buy") {
          const parsed = parseUnits(amountIn, stableDecimals)
          const res = await sdk.buy(stableToken, parsed, minReturn, (hash) => {
            console.log("buy tx sent:", hash)
          })
          setTxResult(`Buy succeeded. Tx: ${res.receipt.transactionHash}`)
        } else {
          const parsed = parseUnits(amountIn, gdDecimals)
          const res = await sdk.sell(stableToken, parsed, minReturn, (hash) => {
            console.log("sell tx sent:", hash)
          })
          setTxResult(`Sell succeeded. Tx: ${res.receipt.transactionHash}`)
        }

        setTxStatus("done")
        return true
      } catch (err) {
        setTxStatus("error")
        setTxError(mapFriendlyError(err, "Transaction failed"))
        return false
      }
    },
    [sdk, direction, stableToken, stableDecimals, gdDecimals],
  )

  const resetTx = useCallback(() => {
    setTxStatus("idle")
    setTxResult(null)
    setTxError(null)
  }, [])

  return { execute, txStatus, txResult, txError, resetTx }
}

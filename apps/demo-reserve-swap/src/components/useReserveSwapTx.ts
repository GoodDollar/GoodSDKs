import { useState, useCallback } from "react"
import { parseUnits } from "viem"
import type { GoodReserveSDK } from "@goodsdks/good-reserve"

type Direction = "buy" | "sell"
type TxStatus = "idle" | "pending" | "done" | "error"

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

export interface UseReserveSwapTxResult {
  execute: (amountIn: string, quote: bigint | null) => Promise<void>
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
    async (amountIn: string, quote: bigint | null) => {
      if (!sdk || !amountIn || quote === null) return

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
      } catch (err) {
        setTxStatus("error")
        setTxError(mapFriendlyError(err, "Transaction failed"))
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

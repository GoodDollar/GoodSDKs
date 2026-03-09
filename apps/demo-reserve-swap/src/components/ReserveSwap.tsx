import { useState, useEffect, useCallback } from "react"
import { useAccount } from "wagmi"
import { useGoodReserve } from "@goodsdks/react-hooks"
import { formatUnits, parseUnits } from "viem"

// cUSD on Celo, USDC on XDC
const TOKEN_ADDRESSES = {
  celo: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const,
  xdc: "0xfA2958CB79b0491CC627c1557F441eF849Ca8eb1" as const,
}

export function ReserveSwap() {
  const { address, chain } = useAccount()
  const {
    sdk,
    loading: sdkLoading,
    error: sdkError,
  } = useGoodReserve("production")

  const [amountIn, setAmountIn] = useState("")
  const [quote, setQuote] = useState<bigint | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [txStatus, setTxStatus] = useState<
    "idle" | "pending" | "done" | "error"
  >("idle")
  const [txResult, setTxResult] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)

  const isXDC = chain?.id === 50
  const activeToken = isXDC ? TOKEN_ADDRESSES.xdc : TOKEN_ADDRESSES.celo
  const tokenSymbol = isXDC ? "USDC" : "cUSD"

  const fetchQuote = useCallback(async () => {
    if (!sdk || !amountIn || isNaN(Number(amountIn))) return

    setQuoteLoading(true)
    try {
      const parsed = parseUnits(amountIn, 18)
      const result = await sdk.getBuyQuote(activeToken, parsed)
      setQuote(result)
    } catch {
      setQuote(null)
    } finally {
      setQuoteLoading(false)
    }
  }, [sdk, amountIn])

  useEffect(() => {
    const timer = setTimeout(fetchQuote, 500)
    return () => clearTimeout(timer)
  }, [fetchQuote])

  const handleBuy = async () => {
    if (!sdk || !amountIn || quote === null) return

    setTxStatus("pending")
    setTxError(null)

    try {
      const parsed = parseUnits(amountIn, 18)
      const minReturn = (quote * 95n) / 100n // 5% slippage
      const { hash } = await sdk.buy(
        activeToken,
        parsed,
        minReturn,
        (hash: `0x${string}`) => {
          console.log("tx sent, waiting for receipt:", hash)
        },
      )
      setTxStatus("done")
      setTxResult(`Success! Hash: ${hash}`)
      setAmountIn("")
      setQuote(null)
    } catch (err) {
      setTxStatus("error")
      setTxError(err instanceof Error ? err.message : "Transaction failed")
    }
  }

  if (!address) return null

  if (sdkLoading) {
    return <div>Loading SDK...</div>
  }

  if (sdkError) {
    return <div style={{ color: "red" }}>{sdkError}</div>
  }

  const containerStyle = {
    padding: "24px",
    borderRadius: "12px",
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
  }

  const inputStyle = {
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    fontSize: "16px",
  }

  const buttonStyle = {
    padding: "12px",
    borderRadius: "8px",
    backgroundColor:
      txStatus === "pending" || !quote || !amountIn ? "#9ca3af" : "#22c55e",
    color: "white",
    fontWeight: "bold",
    border: "none",
    cursor:
      txStatus === "pending" || !quote || !amountIn ? "not-allowed" : "pointer",
    fontSize: "16px",
  }

  return (
    <div style={containerStyle}>
      <h2 style={{ margin: 0 }}>Buy G$</h2>
      <p style={{ margin: 0, color: "#4b5563" }}>
        Swap {tokenSymbol} for GoodDollar (G$) via the {isXDC ? "XDC" : "Celo"}{" "}
        reserve
      </p>

      <input
        type="number"
        placeholder={`Amount in ${tokenSymbol}`}
        value={amountIn}
        onChange={(e) => setAmountIn(e.target.value)}
        style={inputStyle}
      />

      {quoteLoading && <div>Fetching quote...</div>}

      {quote !== null && !quoteLoading && (
        <div style={{ fontSize: "18px", fontWeight: "bold" }}>
          You will receive ~{formatUnits(quote, 2)} G$
        </div>
      )}

      <button
        onClick={handleBuy}
        disabled={txStatus === "pending" || !quote || !amountIn}
        style={buttonStyle}
      >
        {txStatus === "pending" ? "Executing & Simulating Swap..." : "Buy G$"}
      </button>

      {txStatus === "done" && (
        <div style={{ color: "#16a34a", fontWeight: "bold" }}>{txResult}</div>
      )}
      {txStatus === "error" && txError && (
        <div style={{ color: "#dc2626" }}>{txError}</div>
      )}
    </div>
  )
}

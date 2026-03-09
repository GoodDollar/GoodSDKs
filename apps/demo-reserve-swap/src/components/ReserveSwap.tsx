import { useState, useEffect, useCallback } from "react"
import { useAccount } from "wagmi"
import { useGoodReserve } from "@goodsdks/react-hooks"
import { formatUnits, parseUnits } from "viem"

const FALLBACK_STABLE_TOKENS = {
  celo: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const,
  xdc: "0xCCE5f6B605164B7784b4719829d84b0f7493b906" as const,
}

export function ReserveSwap() {
  const { address, chain } = useAccount()
  const reserveEnv = chain?.id === 50 ? "development" : "production"
  const { sdk, loading: sdkLoading, error: sdkError } = useGoodReserve(reserveEnv)

  const [direction, setDirection] = useState<"buy" | "sell">("buy")
  const [amountIn, setAmountIn] = useState("")
  const [quote, setQuote] = useState<bigint | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [decimalsLoading, setDecimalsLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "done" | "error">("idle")
  const [txResult, setTxResult] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [stableDecimals, setStableDecimals] = useState(18)
  const [gdDecimals, setGdDecimals] = useState(18)

  const isXdc = chain?.id === 50
  const chainLabel = isXdc ? "XDC" : "Celo"
  const stableSymbol = isXdc ? "USDC" : "cUSD"
  const fallbackStable = isXdc ? FALLBACK_STABLE_TOKENS.xdc : FALLBACK_STABLE_TOKENS.celo
  const stableToken = sdk?.getStableTokenAddress() ?? fallbackStable

  useEffect(() => {
    if (!sdk) return

    let active = true
    setDecimalsLoading(true)

    const loadDecimals = async () => {
      try {
        const gdToken = sdk.getGoodDollarAddress()
        const [stable, gd] = await Promise.all([
          sdk.getTokenDecimals(stableToken),
          sdk.getTokenDecimals(gdToken),
        ])

        if (!active) return
        setStableDecimals(stable)
        setGdDecimals(gd)
      } catch (err) {
        if (!active) return
        setQuoteError(
          err instanceof Error
            ? `Failed to read token decimals: ${err.message}`
            : "Failed to read token decimals",
        )
      } finally {
        if (active) setDecimalsLoading(false)
      }
    }

    void loadDecimals()

    return () => {
      active = false
    }
  }, [sdk, stableToken])

  const fetchQuote = useCallback(async () => {
    if (!sdk || decimalsLoading || !amountIn || isNaN(Number(amountIn))) return

    setQuoteLoading(true)
    setQuoteError(null)
    try {
      if (direction === "buy") {
        const parsed = parseUnits(amountIn, stableDecimals)
        const result = await sdk.getBuyQuote(stableToken, parsed)
        setQuote(result)
      } else {
        const parsed = parseUnits(amountIn, gdDecimals)
        const result = await sdk.getSellQuote(parsed, stableToken)
        setQuote(result)
      }
    } catch (err: unknown) {
      setQuote(null)
      setQuoteError(err instanceof Error ? err.message : "Failed to fetch quote")
    } finally {
      setQuoteLoading(false)
    }
  }, [sdk, decimalsLoading, amountIn, direction, stableToken, stableDecimals, gdDecimals])

  useEffect(() => {
    const timer = setTimeout(fetchQuote, 400)
    return () => clearTimeout(timer)
  }, [fetchQuote])

  const handleExecute = async () => {
    if (!sdk || !amountIn || quote === null) return

    setTxStatus("pending")
    setTxResult(null)
    setTxError(null)

    try {
      const minReturn = (quote * 95n) / 100n

      if (direction === "buy") {
        const parsed = parseUnits(amountIn, stableDecimals)
        const result = await sdk.buy(stableToken, parsed, minReturn, (hash: `0x${string}`) => {
          console.log("buy tx sent:", hash)
        })
        setTxResult(`Buy succeeded. Tx: ${result.receipt.transactionHash}`)
      } else {
        const parsed = parseUnits(amountIn, gdDecimals)
        const result = await sdk.sell(stableToken, parsed, minReturn, (hash: `0x${string}`) => {
          console.log("sell tx sent:", hash)
        })
        setTxResult(`Sell succeeded. Tx: ${result.receipt.transactionHash}`)
      }

      setTxStatus("done")
      setAmountIn("")
      setQuote(null)
    } catch (err) {
      setTxStatus("error")
      setTxError(err instanceof Error ? err.message : "Transaction failed")
    }
  }

  if (!address) return null

  if (sdkLoading) {
    return (
      <div className="swap-card" style={{ alignItems: "center", justifyContent: "center", minHeight: "200px" }}>
        <p style={{ color: "#64748b", fontWeight: 500 }}>Initializing SDK...</p>
      </div>
    )
  }

  if (sdkError) {
    return (
      <div className="swap-card">
        <div className="status-message status-error">{sdkError}</div>
      </div>
    )
  }

  const inputLabel = direction === "buy" ? stableSymbol : "G$"
  const outputLabel = direction === "buy" ? "G$" : stableSymbol
  const outputValue =
    quote === null
      ? null
      : direction === "buy"
        ? formatUnits(quote, gdDecimals)
        : formatUnits(quote, stableDecimals)

  return (
    <div className="swap-card">
      <div className="swap-header">
        <h2>Reserve Exchange</h2>
        <p>Convert assets via the {chainLabel} GoodReserve</p>
        {isXdc && (
          <p style={{ fontSize: "12px", color: "#64748b", marginTop: "6px" }}>
            XDC demo uses the current development deployment addresses.
          </p>
        )}
      </div>

      <div className="segmented-control">
        <button
          className={`control-btn ${direction === "buy" ? "active" : ""}`}
          onClick={() => {
            setDirection("buy")
            setQuote(null)
            setAmountIn("")
          }}
        >
          Buy G$
        </button>
        <button
          className={`control-btn ${direction === "sell" ? "active" : ""}`}
          onClick={() => {
            setDirection("sell")
            setQuote(null)
            setAmountIn("")
          }}
        >
          Sell G$
        </button>
      </div>

      <div className="input-group">
        <label className="input-label">You Pay ({inputLabel})</label>
        <input
          type="number"
          placeholder="0.00"
          value={amountIn}
          onChange={(e) => setAmountIn(e.target.value)}
          className="custom-input"
        />
      </div>

      {quoteLoading && (
        <div className="quote-view" style={{ alignItems: "center" }}>
          <i style={{ fontSize: "14px", color: "#94a3b8" }}>Fetching live quote...</i>
        </div>
      )}

      {quoteError && (
        <div className="status-message status-error" style={{ fontSize: "12px" }}>
          {quoteError}
        </div>
      )}

      {outputValue !== null && !quoteLoading && (
        <div className="quote-view">
          <span className="quote-label">Estimated Output</span>
          <span className="quote-value">
            {outputValue} {outputLabel}
          </span>
          <span style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
            Included 5% slippage protection
          </span>
        </div>
      )}

      <button
        onClick={handleExecute}
        disabled={txStatus === "pending" || !quote || !amountIn}
        className="primary-button"
      >
        {txStatus === "pending"
          ? "Executing Transaction..."
          : direction === "buy"
            ? `Buy G$ with ${stableSymbol}`
            : `Sell G$ for ${stableSymbol}`}
      </button>

      {txStatus === "done" && txResult && (
        <div className="status-message status-success">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          {txResult}
        </div>
      )}

      {txStatus === "error" && txError && (
        <div className="status-message status-error">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          {txError}
        </div>
      )}
    </div>
  )
}

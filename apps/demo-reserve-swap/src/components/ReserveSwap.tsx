import { useState, useEffect, useCallback } from "react"
import { useAccount } from "wagmi"
import { useGoodReserve } from "@goodsdks/react-hooks"
import { formatUnits, parseUnits } from "viem"

type RouteInfo = {
  env: string
  chainId: number
  mode: "exchange-helper" | "mento-broker"
  stableToken: `0x${string}`
  goodDollar: `0x${string}`
  exchangeHelper?: `0x${string}`
  buyGDFactory?: `0x${string}`
  broker?: `0x${string}`
  exchangeProvider?: `0x${string}`
}

type ReserveStatsState = {
  goodDollarTotalSupply: bigint
  stableTokenDecimals: number
  goodDollarDecimals: number
  poolReserveBalance: bigint | null
  poolTokenSupply: bigint | null
  reserveRatio: number | null
  exitContribution: number | null
}

const FALLBACK_STABLE_TOKENS = {
  celo: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const,
  xdc: "0xCCE5f6B605164B7784b4719829d84b0f7493b906" as const,
}

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
})

const mapFriendlyError = (err: unknown, fallback: string): string => {
  const message = err instanceof Error ? err.message : String(err ?? fallback)
  const lower = message.toLowerCase()

  if (lower.includes("user rejected")) return "Transaction canceled in wallet."
  if (lower.includes("insufficient funds"))
    return "Insufficient funds for token amount or gas."
  if (lower.includes("allowance")) return "Insufficient allowance. Approve and try again."
  if (lower.includes("slippage")) return "Slippage too high. Increase tolerance or reduce trade size."
  if (lower.includes("revert")) return "Quote or swap reverted on-chain. Try a smaller amount."
  if (lower.includes("outflow")) return "Reserve limits may apply (for example, weekly outflow constraints)."

  return message || fallback
}

const formatTokenAmount = (value: bigint, decimals: number): { compact: string; precise: string } => {
  const precise = formatUnits(value, decimals)
  const parsed = Number(precise)
  if (!Number.isFinite(parsed)) return { compact: precise, precise }
  return { compact: compactFormatter.format(parsed), precise }
}

export function ReserveSwap() {
  const { address, chain } = useAccount()
  const reserveEnv = chain?.id === 50 ? "development" : "production"
  const { sdk, loading: sdkLoading, error: sdkError } = useGoodReserve(reserveEnv)

  const [direction, setDirection] = useState<"buy" | "sell">("buy")
  const [amountIn, setAmountIn] = useState("")
  const [quote, setQuote] = useState<bigint | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [decimalsLoading, setDecimalsLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "done" | "error">("idle")
  const [txResult, setTxResult] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)
  const [reserveStats, setReserveStats] = useState<ReserveStatsState | null>(null)
  const [stableDecimals, setStableDecimals] = useState(18)
  const [gdDecimals, setGdDecimals] = useState(18)

  const isXdc = chain?.id === 50
  const chainLabel = isXdc ? "XDC" : "Celo"
  const stableSymbol = isXdc ? "USDC" : "cUSD"
  const fallbackStable = isXdc ? FALLBACK_STABLE_TOKENS.xdc : FALLBACK_STABLE_TOKENS.celo
  const stableToken = sdk?.getStableTokenAddress() ?? fallbackStable

  const loadReserveContext = useCallback(async () => {
    if (!sdk) return

    setDecimalsLoading(true)
    setStatsLoading(true)
    setStatsError(null)

    try {
      const [stats, route] = await Promise.all([
        sdk.getReserveStats(),
        Promise.resolve(sdk.getRouteInfo()),
      ])

      setReserveStats(stats)
      setRouteInfo(route as RouteInfo)
      setStableDecimals(stats.stableTokenDecimals)
      setGdDecimals(stats.goodDollarDecimals)
      console.info("GoodReserve route info", route)
    } catch (err) {
      setStatsError(mapFriendlyError(err, "Failed to read reserve stats"))
    } finally {
      setDecimalsLoading(false)
      setStatsLoading(false)
    }
  }, [sdk])

  useEffect(() => {
    void loadReserveContext()
  }, [loadReserveContext])

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
      setQuoteError(mapFriendlyError(err, "Failed to fetch quote"))
    } finally {
      setQuoteLoading(false)
    }
  }, [sdk, decimalsLoading, amountIn, direction, stableToken, stableDecimals, gdDecimals])

  useEffect(() => {
    const timer = setTimeout(fetchQuote, 400)
    return () => clearTimeout(timer)
  }, [fetchQuote])

  const handleRefresh = useCallback(async () => {
    await loadReserveContext()
    await fetchQuote()
  }, [loadReserveContext, fetchQuote])

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
      setTxError(mapFriendlyError(err, "Transaction failed"))
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
  const outputDetails =
    quote === null
      ? null
      : direction === "buy"
        ? formatTokenAmount(quote, gdDecimals)
        : formatTokenAmount(quote, stableDecimals)
  let impliedPrice: string | null = null
  if (quote !== null && amountIn && !isNaN(Number(amountIn))) {
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
      }
    } catch {
      impliedPrice = null
    }
  }

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

  const reserveRatioPercent =
    reserveStats?.reserveRatio !== null && reserveStats?.reserveRatio !== undefined
      ? (reserveStats.reserveRatio / 10000).toFixed(2)
      : null
  const poolCollateralDetails =
    reserveStats?.poolReserveBalance !== null &&
    reserveStats?.poolReserveBalance !== undefined
      ? formatTokenAmount(reserveStats.poolReserveBalance, stableDecimals)
      : null
  const totalSupplyDetails = reserveStats
    ? formatTokenAmount(reserveStats.goodDollarTotalSupply, gdDecimals)
    : null
  const poolBackingPerGD =
    reserveStats?.poolReserveBalance !== null &&
    reserveStats?.poolReserveBalance !== undefined &&
    reserveStats?.poolTokenSupply !== null &&
    reserveStats?.poolTokenSupply !== undefined &&
    reserveStats.poolTokenSupply > 0n
      ? formatUnits(
          (reserveStats.poolReserveBalance *
            10n ** BigInt(gdDecimals) *
            10n ** 9n) /
            (reserveStats.poolTokenSupply * 10n ** BigInt(stableDecimals)),
          9,
        )
      : null

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
        {!isXdc && (
          <p style={{ fontSize: "12px", color: "#64748b", marginTop: "6px" }}>
            Multi-chain hint: XDC (USDC-backed) is available in parallel when you switch network.
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

      {statsError && (
        <div className="status-message status-error" style={{ fontSize: "12px" }}>
          {statsError}
        </div>
      )}

      {outputDetails !== null && !quoteLoading && (
        <div className="quote-view">
          <span className="quote-label">Estimated Output</span>
          <span className="quote-value" title={`${outputDetails.precise} ${outputLabel}`}>
            {outputDetails.compact} {outputLabel}
          </span>
          <span style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
            Included 5% slippage protection
          </span>
        </div>
      )}

      {impliedPrice && (
        <div className="quote-view" style={{ gap: "8px" }}>
          <span className="quote-label">Reserve Implied Price (Quote)</span>
          <span className="quote-value" style={{ fontSize: "16px" }}>
            1 G$ ≈ {impliedPrice} {stableSymbol}
          </span>
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>
            This is reserve-implied pricing, not external DEX market price.
          </span>
        </div>
      )}

      {lowLiquidityWarning && (
        <div className="status-message" style={{ background: "#fefce8", border: "1px solid #fde68a", color: "#92400e" }}>
          {lowLiquidityWarning}
        </div>
      )}

      <div className="quote-view" style={{ gap: "8px" }}>
        <span className="quote-label">Reserve Stats</span>
        {statsLoading ? (
          <span style={{ fontSize: "14px", color: "#64748b" }}>Loading stats...</span>
        ) : (
          <>
            <span style={{ fontSize: "14px", color: "#334155" }}>
              Pool collateral:{" "}
              {poolCollateralDetails ? (
                <span title={`${poolCollateralDetails.precise} ${stableSymbol}`}>
                  {poolCollateralDetails.compact} {stableSymbol}
                </span>
              ) : (
                "N/A"
              )}
            </span>
            <span style={{ fontSize: "14px", color: "#334155" }}>
              Total G$ supply:{" "}
              {totalSupplyDetails ? (
                <span title={`${totalSupplyDetails.precise} G$`}>
                  {totalSupplyDetails.compact} G$
                </span>
              ) : (
                "N/A"
              )}
            </span>
            <span style={{ fontSize: "14px", color: "#334155" }}>
              Reserve ratio: {reserveRatioPercent ? `${reserveRatioPercent}%` : "N/A"}
            </span>
            <span style={{ fontSize: "14px", color: "#334155" }}>
              Backing floor: {poolBackingPerGD ? `${poolBackingPerGD} ${stableSymbol} / G$` : "N/A"}
            </span>
          </>
        )}
      </div>

      {routeInfo && (
        <div className="quote-view" style={{ gap: "6px" }}>
          <span className="quote-label">Route Addresses</span>
          <span style={{ fontSize: "12px", color: "#475569" }}>
            env: {routeInfo.env} | chainId: {routeInfo.chainId} | mode: {routeInfo.mode}
          </span>
          <span style={{ fontSize: "12px", color: "#475569" }}>
            stable: {routeInfo.stableToken}
          </span>
          <span style={{ fontSize: "12px", color: "#475569" }}>
            gd: {routeInfo.goodDollar}
          </span>
          {routeInfo.broker && (
            <span style={{ fontSize: "12px", color: "#475569" }}>
              broker: {routeInfo.broker}
            </span>
          )}
          {routeInfo.exchangeProvider && (
            <span style={{ fontSize: "12px", color: "#475569" }}>
              exchangeProvider: {routeInfo.exchangeProvider}
            </span>
          )}
          {routeInfo.buyGDFactory && (
            <span style={{ fontSize: "12px", color: "#475569" }}>
              buyGDFactory: {routeInfo.buyGDFactory}
            </span>
          )}
          <button
            className="primary-button"
            style={{ marginTop: "6px", padding: "10px", fontSize: "14px" }}
            onClick={() => console.info("GoodReserve route info", routeInfo)}
          >
            Log Route To Console
          </button>
          <button
            className="primary-button"
            style={{ marginTop: "6px", padding: "10px", fontSize: "14px" }}
            onClick={handleRefresh}
            disabled={statsLoading || quoteLoading}
          >
            Refresh Quotes & Stats
          </button>
        </div>
      )}

      <button
        onClick={handleExecute}
        disabled={txStatus === "pending" || decimalsLoading || !quote || !amountIn}
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

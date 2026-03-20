import { useState, useEffect, useCallback } from "react"
import { useAccount, usePublicClient } from "wagmi"
import { useGoodReserve } from "@goodsdks/react-hooks"
import { erc20ABI, XDC_CHAIN_ID } from "@goodsdks/good-reserve"
import { formatUnits } from "viem"
import { useReserveSwapQuote } from "./useReserveSwapQuote"
import { useReserveSwapTx } from "./useReserveSwapTx"
import { mapFriendlyError } from "../utils/errors"

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

const formatUsd = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return "$0"
  const digits = value >= 1 ? 2 : 6
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  })
  return `$${formatted}`
}

const trimDecimalString = (
  value: string,
  maxFractionDigits: number,
): string => {
  const [integer, fraction = ""] = value.split(".")
  if (!fraction) return integer
  const trimmed = fraction.slice(0, maxFractionDigits).replace(/0+$/, "")
  return trimmed.length > 0 ? `${integer}.${trimmed}` : integer
}

const formatTokenAmount = (
  value: bigint,
  decimals: number,
): { compact: string; precise: string } => {
  const precise = formatUnits(value, decimals)
  if (value === 0n) return { compact: "0", precise }

  const unit = 10n ** BigInt(decimals)
  const oneToken = unit
  const thousandTokens = unit * 1000n
  const microToken = unit / 1_000_000n
  const hundredMillionth = unit / 100_000_000n

  if (value >= thousandTokens) {
    const parsed = Number(precise)
    if (Number.isFinite(parsed))
      return { compact: compactFormatter.format(parsed), precise }
    return { compact: precise, precise }
  }

  if (value >= oneToken) {
    return { compact: trimDecimalString(precise, 4), precise }
  }

  if (value >= microToken) {
    return { compact: trimDecimalString(precise, 8), precise }
  }

  if (value >= hundredMillionth) {
    return { compact: trimDecimalString(precise, 10), precise }
  }

  return { compact: "<0.00000001", precise }
}

const formatAmountForInput = (value: bigint, decimals: number): string => {
  const normalized = formatUnits(value, decimals).replace(/\.?0+$/, "")
  return normalized.length > 0 ? normalized : "0"
}

export function ReserveSwap() {
  const { address, chain } = useAccount()
  const publicClient = usePublicClient()
  const reserveEnv = chain?.id === XDC_CHAIN_ID ? "development" : "production"
  const {
    sdk,
    loading: sdkLoading,
    error: sdkError,
  } = useGoodReserve(reserveEnv)

  const [direction, setDirection] = useState<"buy" | "sell">("buy")
  const [amountIn, setAmountIn] = useState("")
  const [statsLoading, setStatsLoading] = useState(false)
  const [decimalsLoading, setDecimalsLoading] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)
  const [reserveStats, setReserveStats] = useState<ReserveStatsState | null>(
    null,
  )
  const [stableBalance, setStableBalance] = useState<bigint | null>(null)
  const [gdBalance, setGdBalance] = useState<bigint | null>(null)
  const [balancesLoading, setBalancesLoading] = useState(false)
  const [stableDecimals, setStableDecimals] = useState(18)
  const [gdDecimals, setGdDecimals] = useState(18)

  const isXdc = chain?.id === XDC_CHAIN_ID
  const chainLabel = isXdc ? "XDC" : "Celo"
  const stableSymbol = isXdc ? "USDC" : "cUSD"
  const fallbackStable = isXdc
    ? FALLBACK_STABLE_TOKENS.xdc
    : FALLBACK_STABLE_TOKENS.celo
  const stableToken = sdk?.getStableTokenAddress() ?? fallbackStable

  // ── Quote hook (owns quote state + derived values) ──────────────────────────
  const {
    quote,
    quoteLoading,
    quoteError,
    impliedPrice,
    impliedPriceNumber,
    lowLiquidityWarning,
    refetchQuote,
    clearQuote,
  } = useReserveSwapQuote({
    sdk,
    direction,
    amountIn,
    stableToken,
    stableDecimals,
    gdDecimals,
    decimalsLoading,
  })

  // ── Transaction hook (owns tx state + execute logic) ──────────────────────
  const {
    execute: executeSwap,
    txStatus,
    txResult,
    txError,
  } = useReserveSwapTx(sdk, {
    direction,
    stableToken,
    stableDecimals,
    gdDecimals,
  })

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

  const loadBalances = useCallback(async () => {
    if (!sdk || !address || !publicClient) {
      setStableBalance(null)
      setGdBalance(null)
      return
    }

    setBalancesLoading(true)
    try {
      const stableAddress = sdk.getStableTokenAddress()
      const goodDollarAddress = sdk.getGoodDollarAddress()
      const [stable, gd] = await Promise.all([
        publicClient.readContract({
          address: stableAddress,
          abi: erc20ABI,
          functionName: "balanceOf",
          args: [address],
        }),
        publicClient.readContract({
          address: goodDollarAddress,
          abi: erc20ABI,
          functionName: "balanceOf",
          args: [address],
        }),
      ])
      setStableBalance(stable)
      setGdBalance(gd)
    } catch (err) {
      console.warn("Failed to load balances", err)
    } finally {
      setBalancesLoading(false)
    }
  }, [sdk, address, publicClient])

  useEffect(() => {
    void loadBalances()
  }, [loadBalances])

  const handleRefresh = useCallback(async () => {
    await loadReserveContext()
    await refetchQuote()
    await loadBalances()
  }, [loadReserveContext, refetchQuote, loadBalances])

  const handleExecute = async () => {
    await executeSwap(amountIn, quote)
    if (txStatus === "done") {
      setAmountIn("")
    }
  }

  if (!address) return null

  if (sdkLoading) {
    return (
      <div
        className="swap-card"
        style={{
          alignItems: "center",
          justifyContent: "center",
          minHeight: "200px",
        }}
      >
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
  const inputDecimals = direction === "buy" ? stableDecimals : gdDecimals
  const inputBalance = direction === "buy" ? stableBalance : gdBalance
  const inputBalanceDetails =
    inputBalance !== null
      ? formatTokenAmount(inputBalance, inputDecimals)
      : null
  const outputDetails =
    quote === null
      ? null
      : direction === "buy"
        ? formatTokenAmount(quote, gdDecimals)
        : formatTokenAmount(quote, stableDecimals)

  const reserveRatioPercent =
    reserveStats?.reserveRatio !== null &&
    reserveStats?.reserveRatio !== undefined
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
  const poolBackingPerGDNumber = poolBackingPerGD
    ? Number(poolBackingPerGD)
    : null
  const sellUnitPrice =
    impliedPriceNumber !== null
      ? impliedPriceNumber
      : poolBackingPerGDNumber !== null &&
          Number.isFinite(poolBackingPerGDNumber)
        ? poolBackingPerGDNumber
        : null

  const setPercentageAmount = (percent: number) => {
    if (inputBalance === null) return
    const nextAmount = (inputBalance * BigInt(percent)) / 100n
    setAmountIn(formatAmountForInput(nextAmount, inputDecimals))
  }

  const inputStableEquivalent = (() => {
    if (!amountIn || isNaN(Number(amountIn))) return null
    const inputFloat = Number(amountIn)
    if (!Number.isFinite(inputFloat) || inputFloat <= 0) return null
    if (direction === "buy") return inputFloat
    if (sellUnitPrice === null) return null
    return inputFloat * sellUnitPrice
  })()

  const outputStableEquivalent = (() => {
    if (quote === null) return null
    if (direction === "sell") {
      const stable = Number(formatUnits(quote, stableDecimals))
      return Number.isFinite(stable) ? stable : null
    }
    if (sellUnitPrice === null) return null
    const gdOut = Number(formatUnits(quote, gdDecimals))
    if (!Number.isFinite(gdOut)) return null
    return gdOut * sellUnitPrice
  })()

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
            Multi-chain hint: XDC (USDC-backed) is available in parallel when
            you switch network.
          </p>
        )}
      </div>

      <div className="segmented-control">
        <button
          className={`control-btn ${direction === "buy" ? "active" : ""}`}
          onClick={() => {
            setDirection("buy")
            clearQuote()
            setAmountIn("")
          }}
        >
          Buy G$
        </button>
        <button
          className={`control-btn ${direction === "sell" ? "active" : ""}`}
          onClick={() => {
            setDirection("sell")
            clearQuote()
            setAmountIn("")
          }}
        >
          Sell G$
        </button>
      </div>

      <div className="input-group">
        <label className="input-label">You Pay ({inputLabel})</label>
        <div className="input-meta">
          <button
            type="button"
            className="balance-button"
            onClick={() => setPercentageAmount(100)}
            disabled={balancesLoading || inputBalance === null}
          >
            Balance:{" "}
            {inputBalanceDetails
              ? `${inputBalanceDetails.compact} ${inputLabel}`
              : "..."}
          </button>
          <div className="quick-actions">
            {[25, 50, 75, 100].map((percent) => (
              <button
                key={percent}
                type="button"
                className="quick-action-btn"
                onClick={() => setPercentageAmount(percent)}
                disabled={balancesLoading || inputBalance === null}
              >
                {percent}%
              </button>
            ))}
          </div>
        </div>
        <input
          type="number"
          placeholder="0.00"
          value={amountIn}
          onChange={(e) => setAmountIn(e.target.value)}
          className="custom-input"
        />
        {inputStableEquivalent !== null && (
          <div className="value-note">{formatUsd(inputStableEquivalent)}</div>
        )}
      </div>

      {quoteLoading && (
        <div className="quote-view" style={{ alignItems: "center" }}>
          <i style={{ fontSize: "14px", color: "#94a3b8" }}>
            Fetching live quote...
          </i>
        </div>
      )}

      {quoteError && (
        <div
          className="status-message status-error"
          style={{ fontSize: "12px" }}
        >
          {quoteError}
        </div>
      )}

      {statsError && (
        <div
          className="status-message status-error"
          style={{ fontSize: "12px" }}
        >
          {statsError}
        </div>
      )}

      {outputDetails !== null && !quoteLoading && (
        <div className="quote-view">
          <span className="quote-label">Estimated Output ({outputLabel})</span>
          <span
            className="quote-value"
            title={`${outputDetails.precise} ${outputLabel}`}
          >
            {outputDetails.compact} {outputLabel}
          </span>
          {outputStableEquivalent !== null && (
            <span className="value-note">
              {(() => {
                const pct =
                  inputStableEquivalent && inputStableEquivalent > 0
                    ? ((outputStableEquivalent - inputStableEquivalent) /
                        inputStableEquivalent) *
                      100
                    : null
                return pct === null
                  ? formatUsd(outputStableEquivalent)
                  : `${formatUsd(outputStableEquivalent)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)`
              })()}
            </span>
          )}
          <div className="summary-meta">
            <span>Slippage guard: 5%</span>
            {impliedPrice && (
              <span title="Reserve implied price from current quote">
                1 G$ ≈ {impliedPrice} {stableSymbol}
              </span>
            )}
          </div>
        </div>
      )}

      {lowLiquidityWarning && (
        <div
          className="status-message"
          style={{
            background: "#fefce8",
            border: "1px solid #fde68a",
            color: "#92400e",
          }}
        >
          {lowLiquidityWarning}
        </div>
      )}

      <div className="action-row">
        <button
          onClick={handleExecute}
          disabled={
            txStatus === "pending" || decimalsLoading || !quote || !amountIn
          }
          className="primary-button"
        >
          {txStatus === "pending"
            ? "Executing..."
            : direction === "buy"
              ? `Buy G$ with ${stableSymbol}`
              : `Sell G$ for ${stableSymbol}`}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={handleRefresh}
          disabled={statsLoading || quoteLoading}
        >
          Refresh
        </button>
      </div>

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

      <details className="advanced-panel">
        <summary className="advanced-toggle">Advanced stats and route</summary>
        <div className="advanced-content">
          <div className="quote-view" style={{ gap: "8px" }}>
            <span className="quote-label">Reserve Stats</span>
            {statsLoading ? (
              <span style={{ fontSize: "13px", color: "#64748b" }}>
                Loading stats...
              </span>
            ) : (
              <>
                <span style={{ fontSize: "13px", color: "#334155" }}>
                  Pool collateral:{" "}
                  {poolCollateralDetails ? (
                    <span
                      title={`${poolCollateralDetails.precise} ${stableSymbol}`}
                    >
                      {poolCollateralDetails.compact} {stableSymbol}
                    </span>
                  ) : (
                    "N/A"
                  )}
                </span>
                <span style={{ fontSize: "13px", color: "#334155" }}>
                  Total G$ supply:{" "}
                  {totalSupplyDetails ? (
                    <span title={`${totalSupplyDetails.precise} G$`}>
                      {totalSupplyDetails.compact} G$
                    </span>
                  ) : (
                    "N/A"
                  )}
                </span>
                <span style={{ fontSize: "13px", color: "#334155" }}>
                  Reserve ratio:{" "}
                  {reserveRatioPercent ? `${reserveRatioPercent}%` : "N/A"}
                </span>
                <span style={{ fontSize: "13px", color: "#334155" }}>
                  Backing floor:{" "}
                  {poolBackingPerGD
                    ? `${poolBackingPerGD} ${stableSymbol} / G$`
                    : "N/A"}
                </span>
              </>
            )}
          </div>

          {routeInfo && (
            <div className="quote-view" style={{ gap: "6px" }}>
              <span className="quote-label">Route Addresses</span>
              <span style={{ fontSize: "12px", color: "#475569" }}>
                env: {routeInfo.env} | chainId: {routeInfo.chainId} | mode:{" "}
                {routeInfo.mode}
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
                className="secondary-button"
                style={{ width: "100%" }}
                onClick={() =>
                  console.info("GoodReserve route info", routeInfo)
                }
              >
                Log Route To Console
              </button>
            </div>
          )}
        </div>
      </details>
    </div>
  )
}

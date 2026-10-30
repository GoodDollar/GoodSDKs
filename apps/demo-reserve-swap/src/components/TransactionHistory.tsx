import { useState, useEffect, useCallback, useRef } from "react"
import { useAccount } from "wagmi"
import { useGoodReserve } from "@goodsdks/react-hooks"
import { XDC_CHAIN_ID } from "@goodsdks/good-reserve"
import type { GoodReserveSDK, ReserveEvent } from "@goodsdks/good-reserve"
import { formatUnits } from "viem"
import { mapFriendlyError } from "../utils/errors"

const getExplorerUrl = (chainId: number | undefined, hash: string) => {
  if (chainId === XDC_CHAIN_ID) {
    return `https://explorer.xdc.org/tx/${hash}`
  }
  return `https://explorer.celo.org/mainnet/tx/${hash}`
}

// Celo block time is ~5s. XDC is ~2s. I used conservative Celo-based math
// RPC nodes often hard-cap eth_getLogs at 50,000 blocks
const presets = [
  { label: "Last 6 Hours", blocks: 4500n },
  { label: "Last 24 Hours", blocks: 18000n },
  { label: "Last 3 Days", blocks: 50000n },
]

export function TransactionHistory() {
  const { address } = useAccount()

  const { sdk, loading: sdkLoading, error: sdkError } = useGoodReserve("production")
  const route = sdk?.getRouteInfo()
  const isXdc = route?.chainId === XDC_CHAIN_ID

  const [historyContext, setHistoryContext] = useState<{
    sdk: GoodReserveSDK
    address: string
    preset: number
    events: ReserveEvent[]
    decimals: Record<string, number>
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const invalidateHistory = useCallback(() => { generation.current++ }, [])

  // Default to 24 hours
  const [selectedPreset, setSelectedPreset] = useState(1)
  const [visibleCount, setVisibleCount] = useState(5)
  const current = historyContext?.sdk === sdk && historyContext?.address === address && historyContext?.preset === selectedPreset ? historyContext : null
  const events = current?.events ?? []

  const fetchHistory = useCallback(async () => {
    const id = ++generation.current
    setHistoryContext(null)
    setError(null)
    if (!sdk || !address) {
      setLoading(false)
      return
    }

    setLoading(true)
    setVisibleCount(5)

    try {
      const history = await sdk.getTransactionHistory(address, {
        blocksAgo: presets[selectedPreset].blocks,
      })
      const activeRoute = sdk.getRouteInfo()
      const tokens = [...new Set([
        activeRoute.stableToken,
        activeRoute.goodDollar,
        ...history.flatMap(event => [event.tokenIn, event.tokenOut]),
      ].map(token => token.toLowerCase() as `0x${string}`))]
      const decimals = Object.fromEntries(await Promise.all(
        tokens.map(async token => [token, await sdk.getTokenDecimals(token)]),
      ))
      if (generation.current !== id) return

      // Sort descending by block number (newest first)
      history.sort((a, b) => Number(b.block - a.block))
      setHistoryContext({ sdk, address, preset: selectedPreset, events: history, decimals })
    } catch (err) {
      if (generation.current !== id) return
      setHistoryContext(null)
      const errorMsg = err instanceof Error ? err.message : String(err)
      if (errorMsg.includes("exceeded") || errorMsg.includes("Too many")) {
        setError("The RPC node rejected the large block range. Please try a shorter time preset.")
      } else {
        setError(mapFriendlyError(err, "Failed to load transaction history"))
      }
    } finally {
      if (generation.current === id) setLoading(false)
    }
  }, [sdk, address, selectedPreset])

  useEffect(() => {
    void fetchHistory()
    return invalidateHistory
  }, [fetchHistory, invalidateHistory])

  if (!address) {
    return (
      <div className="swap-card" style={{ marginTop: "24px", textAlign: "center", padding: "20px" }}>
        <p style={{ color: "var(--text-secondary)" }}>
          Connect your wallet to view your reserve transaction history.
        </p>
      </div>
    )
  }

  return (
    <div className="swap-card" style={{ marginTop: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <h2>Transaction History</h2>
        <button
          onClick={fetchHistory}
          disabled={loading || sdkLoading || !sdk}
          style={{
            background: "none",
            border: "none",
            color: "var(--accent-color)",
            cursor: "pointer",
            fontSize: "14px",
            textDecoration: "underline",
          }}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "16px" }}>
        Decoded reserve swaps for your wallet (from the MentoBroker `Swap` event).
      </p>

      {/* Preset Range Buttons */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        {presets.map((preset, index) => (
          <button
            key={index}
            onClick={() => setSelectedPreset(index)}
            disabled={loading}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              background: selectedPreset === index ? "var(--accent-color)" : "var(--bg-main)",
              color: selectedPreset === index ? "white" : "var(--text-primary)",
              border: "1px solid var(--border-color)",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              opacity: loading && selectedPreset !== index ? 0.6 : 1,
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {(error || sdkError) && (
        <div className="status-message error-message" style={{ marginBottom: "16px" }}>
          {error || sdkError}
        </div>
      )}

      {loading && <p style={{ textAlign: "center", color: "var(--text-secondary)", padding: "20px" }}>Scanning blockchain logs...</p>}

      {!loading && !sdkLoading && events.length === 0 && !error && !sdkError && (
        <p style={{ textAlign: "center", color: "var(--text-secondary)", padding: "20px" }}>
          No reserve transactions found in this time range.
        </p>
      )}

      {current && events.length > 0 && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {events.slice(0, visibleCount).map((ev) => {
            const isBuy = ev.type === "buy"
            const inDecimals = current.decimals[ev.tokenIn.toLowerCase()]
            const outDecimals = current.decimals[ev.tokenOut.toLowerCase()]

            const amountIn = formatUnits(ev.amountIn, inDecimals)
            const amountOut = formatUnits(ev.amountOut, outDecimals)
            const stableSymbol = isXdc ? "USDC" : "cUSD"

            return (
              <div
                key={`${ev.tx}-${ev.type}`}
                style={{
                  padding: "12px",
                  background: "var(--bg-card)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: isBuy ? "#10b981" : "#ef4444", marginBottom: "4px" }}>
                    {ev.type.toUpperCase()} G$
                  </div>
                  <a
                    href={getExplorerUrl(route?.chainId, ev.tx)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--accent-color)", fontSize: "12px", textDecoration: "underline" }}
                  >
                    View on Explorer ↗
                  </a>
                </div>

                <div style={{ textAlign: "right", fontSize: "14px", color: "var(--text-primary)" }}>
                  <div>
                    In: <strong>{Number(amountIn).toLocaleString(undefined, { maximumFractionDigits: 4 })}</strong> {isBuy ? stableSymbol : "G$"}
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "2px" }}>
                    Out: {Number(amountOut).toLocaleString(undefined, { maximumFractionDigits: 4 })} {isBuy ? "G$" : stableSymbol}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {events.length > visibleCount && !loading && (
        <button
          onClick={() => setVisibleCount((prev) => prev + 5)}
          style={{
            marginTop: "12px",
            width: "100%",
            padding: "8px",
            background: "none",
            border: "1px solid var(--border-color)",
            borderRadius: "6px",
            color: "var(--text-primary)",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Show More ({events.length - visibleCount} remaining)
        </button>
      )}

      <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "16px", textAlign: "center" }}>
        Showing recent transactions (last few hours) due to RPC limits.
      </p>
    </div>
  )
}
import { useState, useEffect, useCallback } from "react"
import { useAccount } from "wagmi"
import { useGoodReserve } from "@goodsdks/react-hooks"
import { XDC_CHAIN_ID } from "@goodsdks/good-reserve"
import type { ReserveEvent } from "@goodsdks/good-reserve"
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
  const { address, chain } = useAccount()
  const isXdc = chain?.id === XDC_CHAIN_ID
  const reserveEnv = isXdc ? "development" : "production"

  const { sdk, loading: sdkLoading } = useGoodReserve(reserveEnv)

  const [events, setEvents] = useState<ReserveEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Default to 24 hours
  const [selectedPreset, setSelectedPreset] = useState(1)
  const [visibleCount, setVisibleCount] = useState(5)

  const fetchHistory = useCallback(async () => {
    if (!sdk || !address) return

    setLoading(true)
    setError(null)
    setVisibleCount(5)

    try {
      const history = await sdk.getTransactionHistory(address, {
        blocksAgo: presets[selectedPreset].blocks,
      })

      // Sort descending by block number (newest first)
      history.sort((a, b) => Number(b.block - a.block))
      setEvents(history)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      if (errorMsg.includes("exceeded") || errorMsg.includes("Too many")) {
        setError("The RPC node rejected the large block range. Please try a shorter time preset.")
      } else {
        setError(mapFriendlyError(err, "Failed to load transaction history"))
      }
    } finally {
      setLoading(false)
    }
  }, [sdk, address, selectedPreset])

  useEffect(() => {
    if (!address) {
      setEvents([])
      return
    }
    fetchHistory()
  }, [fetchHistory, address])

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
          disabled={loading || sdkLoading}
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

      {(error) && (
        <div className="status-message error-message" style={{ marginBottom: "16px" }}>
          {error}
        </div>
      )}

      {loading && <p style={{ textAlign: "center", color: "var(--text-secondary)", padding: "20px" }}>Scanning blockchain logs...</p>}

      {!loading && events.length === 0 && !error && (
        <p style={{ textAlign: "center", color: "var(--text-secondary)", padding: "20px" }}>
          No reserve transactions found in this time range.
        </p>
      )}

      {events.length > 0 && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {events.slice(0, visibleCount).map((ev) => {
            const isBuy = ev.type === "buy"
            const stableDec = isXdc ? 6 : 18  // USDC=6 on XDC, cUSD=18 on Celo 
            const inDecimals = isBuy ? stableDec : 18
            const outDecimals = isBuy ? 18 : stableDec

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
                    href={getExplorerUrl(chain?.id, ev.tx)}
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
import "@goodsdks/liquidity-widget"
import React, { useEffect, useRef } from "react"
import type { GooddollarLiquidityWidget } from "@goodsdks/liquidity-widget"

type WidgetTheme = {
  primaryColor?: string
  borderRadius?: string
  fontFamily?: string
}

export type LiquidityWidgetProps = {
  web3Provider: unknown | null
  connectWallet?: () => void
  explorerBaseUrl?: string
  approvalBuffer?: number
  defaultRange?: "full" | "wide" | "narrow"
  showPositions?: boolean
  refreshInterval?: number
  theme?: WidgetTheme
  onTxSubmitted?: (detail: { hash: string; step: string }) => void
  onTxConfirmed?: (detail: { hash: string; step: string }) => void
  onTxFailed?: (detail: { hash: string; step: string; error: string }) => void
  onPositionAdded?: (detail: { hash: string }) => void
}

export const LiquidityWidget: React.FC<LiquidityWidgetProps> = (props) => {
  const ref = useRef<GooddollarLiquidityWidget | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.web3Provider = props.web3Provider ?? null
    el.connectWallet = props.connectWallet
    el.theme = props.theme
  }, [props.web3Provider, props.connectWallet, props.theme])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const s = (e: Event) => props.onTxSubmitted?.((e as CustomEvent).detail)
    const c = (e: Event) => props.onTxConfirmed?.((e as CustomEvent).detail)
    const f = (e: Event) => props.onTxFailed?.((e as CustomEvent).detail)
    const p = (e: Event) => props.onPositionAdded?.((e as CustomEvent).detail)
    el.addEventListener("lw-tx-submitted", s)
    el.addEventListener("lw-tx-confirmed", c)
    el.addEventListener("lw-tx-failed", f)
    el.addEventListener("lw-position-added", p)
    return () => {
      el.removeEventListener("lw-tx-submitted", s)
      el.removeEventListener("lw-tx-confirmed", c)
      el.removeEventListener("lw-tx-failed", f)
      el.removeEventListener("lw-position-added", p)
    }
  }, [
    props.onTxSubmitted,
    props.onTxConfirmed,
    props.onTxFailed,
    props.onPositionAdded,
  ])

  return (
    <gooddollar-liquidity-widget
      ref={ref}
      explorer-base-url={props.explorerBaseUrl}
      approval-buffer={props.approvalBuffer}
      default-range={props.defaultRange}
      show-positions={props.showPositions ? "" : undefined}
      refresh-interval={props.refreshInterval}
    />
  )
}

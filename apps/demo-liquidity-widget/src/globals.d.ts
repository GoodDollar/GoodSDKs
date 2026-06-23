import type { GooddollarLiquidityWidget } from "@goodsdks/liquidity-widget/src/GooddollarLiquidityWidget"
import type { DetailedHTMLProps, HTMLAttributes, Ref } from "react"

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "appkit-button": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >
      "gooddollar-liquidity-widget": DetailedHTMLProps<
        HTMLAttributes<GooddollarLiquidityWidget> & {
          ref?: Ref<GooddollarLiquidityWidget>
          "explorer-base-url"?: string
          "approval-buffer"?: number
          "default-range"?: "full" | "wide" | "narrow"
          "show-positions"?: string
          "refresh-interval"?: number
        },
        GooddollarLiquidityWidget
      >
    }
  }
}

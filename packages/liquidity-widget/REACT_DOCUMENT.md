# Using `@goodsdks/liquidity-widget` in React

The liquidity widget is a [Lit](https://lit.dev) **web component** registered as the custom element `<gooddollar-liquidity-widget>`. Because it is a standard DOM element, it can be dropped into any React app — you just need to pass the wallet plumbing (an EIP-1193 `web3Provider` and a `connectWallet` callback) from your wallet library of choice.

This guide covers:

- [Using `@goodsdks/liquidity-widget` in React](#using-goodsdksliquidity-widget-in-react)
  - [1. Installation \& Registration](#1-installation--registration)
  - [2. A `<LiquidityWidget />` React wrapper](#2-a-liquiditywidget--react-wrapper)
  - [3. Integrating with wagmi](#3-integrating-with-wagmi)
  - [4. Integrating with Reown AppKit](#4-integrating-with-reown-appkit)
  - [5. Listening to widget events](#5-listening-to-widget-events)
  - [6. TypeScript / JSX support](#6-typescript--jsx-support)
  - [Props reference](#props-reference)

---

## 1. Installation & Registration

Install the widget and your wallet library:

```bash
yarn add @goodsdks/liquidity-widget
# pick one (or both) for wallet plumbing:
yarn add wagmi viem @tanstack/react-query
yarn add @reown/appkit @reown/appkit-adapter-wagmi
```

Import the package once at the entrypoint of your app. The import has the side effect of registering the `<gooddollar-liquidity-widget>` custom element:

```tsx
// src/main.tsx (or _app.tsx, etc.)
import "@goodsdks/liquidity-widget";
```

> If you are using Next.js (App Router), register the element inside a client component (`"use client"`) so it is only loaded in the browser.

---

## 2. A `<LiquidityWidget />` React wrapper

Two of the widget's integrator inputs — `web3Provider` and `connectWallet` — are **JS properties**, not HTML attributes. React <19 serializes unknown attributes to strings, so you must set these through a `ref`. The wrapper below handles that and works in both React 18 and 19.

```tsx
// src/LiquidityWidget.tsx
"use client";

import "@goodsdks/liquidity-widget";
import { useEffect, useRef } from "react";
import type { GooddollarLiquidityWidget } from "@goodsdks/liquidity-widget";

type WidgetTheme = {
  primaryColor?: string;
  borderRadius?: string;
  fontFamily?: string;
};

export type LiquidityWidgetProps = {
  web3Provider: unknown | null;
  connectWallet?: () => void;
  explorerBaseUrl?: string;
  approvalBuffer?: number;
  defaultRange?: "full" | "wide" | "narrow";
  showPositions?: boolean;
  refreshInterval?: number;
  theme?: WidgetTheme;
  onTxSubmitted?: (detail: { hash: string; step: string }) => void;
  onTxConfirmed?: (detail: { hash: string; step: string }) => void;
  onTxFailed?: (detail: { hash: string; step: string; error: string }) => void;
  onPositionAdded?: (detail: { hash: string }) => void;
};

export function LiquidityWidget(props: LiquidityWidgetProps) {
  const ref = useRef<GooddollarLiquidityWidget | null>(null);

  // Set JS properties (not serializable as attributes).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.web3Provider = props.web3Provider ?? null;
    el.connectWallet = props.connectWallet;
    el.theme = props.theme;
  }, [props.web3Provider, props.connectWallet, props.theme]);

  // Forward events.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const s = (e: Event) => props.onTxSubmitted?.((e as CustomEvent).detail);
    const c = (e: Event) => props.onTxConfirmed?.((e as CustomEvent).detail);
    const f = (e: Event) => props.onTxFailed?.((e as CustomEvent).detail);
    const p = (e: Event) => props.onPositionAdded?.((e as CustomEvent).detail);
    el.addEventListener("lw-tx-submitted", s);
    el.addEventListener("lw-tx-confirmed", c);
    el.addEventListener("lw-tx-failed", f);
    el.addEventListener("lw-position-added", p);
    return () => {
      el.removeEventListener("lw-tx-submitted", s);
      el.removeEventListener("lw-tx-confirmed", c);
      el.removeEventListener("lw-tx-failed", f);
      el.removeEventListener("lw-position-added", p);
    };
  }, [props.onTxSubmitted, props.onTxConfirmed, props.onTxFailed, props.onPositionAdded]);

  return (
    <gooddollar-liquidity-widget
      ref={ref}
      explorer-base-url={props.explorerBaseUrl}
      approval-buffer={props.approvalBuffer}
      default-range={props.defaultRange}
      show-positions={props.showPositions ? "" : undefined}
      refresh-interval={props.refreshInterval}
    />
  );
}
```

> Scalar attributes (`explorer-base-url`, `approval-buffer`, …) are fine as HTML attributes — Lit coerces them based on the `@property({ type: ... })` declarations. Object, function, and boolean-as-flag values must go through the ref.

---

## 3. Integrating with wagmi

wagmi's connectors expose an EIP-1193 provider via `connector.getProvider()`. The widget expects that provider plus a `connectWallet` callback that opens your connect modal.

```tsx
// src/LiquidityPage.tsx
"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useConnectors, useChainId, useSwitchChain } from "wagmi";
import { celo } from "wagmi/chains";
import { LiquidityWidget } from "./LiquidityWidget";

export function LiquidityPage() {
  const { address, isConnected, connector } = useAccount();
  const { connect } = useConnect();
  const connectors = useConnectors();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [provider, setProvider] = useState<unknown | null>(null);

  // Pull the EIP-1193 provider off the active connector.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isConnected || !connector) {
        setProvider(null);
        return;
      }
      const p = await connector.getProvider();
      if (!cancelled) setProvider(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected, connector, address]);

  // Widget pool lives on Celo.
  useEffect(() => {
    if (isConnected && chainId !== celo.id) switchChain({ chainId: celo.id });
  }, [isConnected, chainId, switchChain]);

  return (
    <LiquidityWidget
      web3Provider={provider}
      connectWallet={() => connect({ connector: connectors[0] })}
      onPositionAdded={({ hash }) => console.log("Minted position:", hash)}
      theme={{ primaryColor: "#00b0ff", borderRadius: "16px" }}
    />
  );
}
```

Wrap your app with a wagmi + react-query provider as usual:

```tsx
// src/providers.tsx
"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { celo } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const config = createConfig({
  chains: [celo],
  transports: { [celo.id]: http() },
  connectors: [injected()],
});

const qc = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
```

> The widget will not send transactions from an account on a network other than Celo. If your app supports multiple chains, switch to Celo before the user interacts with the widget (shown above).

---

## 4. Integrating with Reown AppKit

AppKit provides its own EIP-1193 provider and connect modal. When using the wagmi adapter, you still reuse the wagmi-based flow from §3 — the widget consumes the provider from wagmi's active connector, and `connectWallet` opens the AppKit modal.

```tsx
// src/appkit.ts
"use client";

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { celo } from "@reown/appkit/networks";

const projectId = import.meta.env.VITE_WC_PROJECT_ID!;

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: [celo],
});

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks: [celo],
  projectId,
  metadata: {
    name: "My dApp",
    description: "G$ liquidity",
    url: "https://example.com",
    icons: [],
  },
});
```

```tsx
// src/LiquidityPage.tsx
"use client";

import { useEffect, useState } from "react";
import { useAppKit, useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { LiquidityWidget } from "./LiquidityWidget";

export function LiquidityPage() {
  const { open } = useAppKit();
  const { isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<unknown>("eip155");

  const [provider, setProvider] = useState<unknown | null>(null);
  useEffect(() => {
    setProvider(isConnected ? walletProvider ?? null : null);
  }, [isConnected, walletProvider]);

  return (
    <LiquidityWidget
      web3Provider={provider}
      connectWallet={() => open()}
      onPositionAdded={({ hash }) => console.log("Minted:", hash)}
    />
  );
}
```

> If you are not using the wagmi adapter, you can subscribe to AppKit directly — see [README.md](./README.md) for the vanilla-JS `appKit.subscribeAccount(...)` pattern.

---

## 5. Listening to widget events

The widget dispatches four custom DOM events. The wrapper from §2 forwards them as props:

| Event                | Detail                                   | When                         |
| -------------------- | ---------------------------------------- | ---------------------------- |
| `lw-tx-submitted`    | `{ hash, step }`                         | Wallet returned a tx hash    |
| `lw-tx-confirmed`    | `{ hash, step }`                         | Tx confirmed on-chain        |
| `lw-tx-failed`       | `{ hash, step, error }`                  | Tx failed or was rejected    |
| `lw-position-added`  | `{ hash }`                               | New position minted          |

`step` is one of `approve-gd`, `approve-usdglo`, or `mint`.

```tsx
<LiquidityWidget
  web3Provider={provider}
  onTxSubmitted={({ hash, step }) => analytics.track("lw_submit", { hash, step })}
  onPositionAdded={({ hash }) => toast.success(`Minted: ${hash}`)}
/>
```

---

## 6. TypeScript / JSX support

Declare the custom element on `JSX.IntrinsicElements` so `<gooddollar-liquidity-widget>` type-checks inside JSX:

```ts
// src/types/liquidity-widget.d.ts
import type { GooddollarLiquidityWidget } from "@goodsdks/liquidity-widget";
import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "gooddollar-liquidity-widget": DetailedHTMLProps<
        HTMLAttributes<GooddollarLiquidityWidget> & {
          "explorer-base-url"?: string;
          "approval-buffer"?: number;
          "default-range"?: "full" | "wide" | "narrow";
          "show-positions"?: string;
          "refresh-interval"?: number;
        },
        GooddollarLiquidityWidget
      >;
    }
  }
}
```

---

## Props reference

See [README.md](./README.md) for the full list. The most common ones:

- `web3Provider` — EIP-1193 provider from wagmi / AppKit. `null` when disconnected.
- `connectWallet` — called when the user clicks "Connect Wallet".
- `explorerBaseUrl` — default `https://celoscan.io`.
- `approvalBuffer` — percentage buffer on top of approvals (default `5`).
- `defaultRange` — `"full" | "wide" | "narrow"` (default `"full"`).
- `showPositions` — toggles the "My Positions" tab.
- `refreshInterval` — ms between pool/balance refreshes, `0` to disable.
- `theme` — `{ primaryColor?, borderRadius?, fontFamily? }`.

# @goodsdks/good-reserve

SDK for buying and selling G$ through the GoodDollar reserve using viem.

The reserve runs on **Celo mainnet** and **XDC mainnet**, including production XDC's USDC-backed reserve. Development remains available when explicitly selected; there is no automatic environment fallback.

## Installation

```bash
yarn add @goodsdks/good-reserve viem
```

## Usage

### Viem (framework-agnostic)

```ts
import { GoodReserveSDK } from "@goodsdks/good-reserve"
import { createPublicClient, createWalletClient, custom, http, parseUnits } from "viem"
import { celo } from "viem/chains"

const publicClient = createPublicClient({ chain: celo, transport: http() })
const walletClient = createWalletClient({ chain: celo, transport: custom(window.ethereum) })

const sdk = new GoodReserveSDK(publicClient, walletClient, "production")
const stable = sdk.getStableTokenAddress()
const gd = sdk.getGoodDollarAddress()
const [stableDecimals, gdDecimals] = await Promise.all([
  sdk.getTokenDecimals(stable),
  sdk.getTokenDecimals(gd),
])
const stableIn = parseUnits("10", stableDecimals)
const gdIn = parseUnits("100", gdDecimals)

// Get a buy quote
const gdOut = await sdk.getBuyQuote(stable, stableIn)

// Buy G$ with cUSD
const { hash: buyHash, receipt: buyReceipt } = await sdk.buy(
  stable,
  stableIn,
  (gdOut * 97n) / 100n,
)

// Get a sell quote
const stableOut = await sdk.getSellQuote(gdIn, stable)

// Sell G$
const { hash: sellHash, receipt: sellReceipt } = await sdk.sell(
  stable,
  gdIn,
  (stableOut * 97n) / 100n,
)

// Fetch transaction history
const [account] = await walletClient.getAddresses()
const history = await sdk.getTransactionHistory(account)
```

### React / Wagmi

```tsx
import { useGoodReserve } from "@goodsdks/react-hooks"
import { parseUnits } from "viem"

function ReserveButton() {
  const { sdk, loading, error } = useGoodReserve("production")

  const handleBuy = async () => {
    if (!sdk) return
    const stable = sdk.getStableTokenAddress()
    const decimals = await sdk.getTokenDecimals(stable)
    const amount = parseUnits("10", decimals)
    const quote = await sdk.getBuyQuote(stable, amount)
    await sdk.buy(stable, amount, (quote * 97n) / 100n)
  }

  return <button disabled={loading || !sdk || !!error} onClick={handleBuy}>Buy G$</button>
}
```

## API

### Initialization Options

The `GoodReserveSDK` constructor accepts an `options` object as its fourth argument.

- `exactApproval` (`boolean`, default: `true`): When `true`, buy/sell transactions approve only the exact token amount required for the swap. Set to `false` to approve an infinite amount (`maxUint256`). While `false` reduces gas costs on future swaps, it is less secure.

### `GoodReserveSDK`

| Method                                       | Description                                         |
| -------------------------------------------- | --------------------------------------------------- |
| `getBuyQuote(tokenIn, amountIn)`             | Returns estimated G$ output for a given token input |
| `getSellQuote(gdAmount, sellTo)`             | Returns estimated token output for a given G$ input |
| `getGDBalance(account)`                      | Returns G$ balance of an account                    |
| `getTokenDecimals(token)`                    | Resolves token-native decimals for the active route |
| `getRouteInfo()`                             | Returns the selected chain, environment and addresses |
| `getReserveStats()`                          | Returns raw reserve stats with the units below      |
| `getTransactionHistory(account, options?)`   | Returns past buy/sell events for an account         |
| `buy(tokenIn, amountIn, minReturn, onHash?)` | Approves and buys G$                                |
| `sell(sellTo, gdAmount, minReturn, onHash?)` | Approves and sells G$                               |

### Transaction safety

Write operations check the wallet's live chain against the public client's configured chain before approval and swap, and recheck after simulation immediately before submission. Switch the wallet to the read-client chain before retrying a mismatch. Submission also pins viem's expected chain; a cached `walletClient.chain` alone is not used as proof of the active network.

Both approval and final swap receipts must have status `success`. A reverted receipt rejects with the exported `ReserveTransactionError`, whose `hash` and `receipt` retain diagnostics. Failed approval never proceeds to swap. `onHash` fires on submission (including approvals), **not** on success; report success only after `buy`/`sell` resolves. Catch failures in your UI and refresh the quote before retrying.

### Stats units and normalization

`ReserveStats` remains the raw API:

| Field | Unit |
| --- | --- |
| `goodDollarTotalSupply` | G$ token-native base units; use `goodDollarDecimals` |
| `stableTokenDecimals`, `goodDollarDecimals` | ERC-20 metadata for the active route's tokens |
| `poolReserveBalance` | Reserve-token units normalized to **18 decimals**, including 6-decimal USDC |
| `poolTokenSupply` | G$ pool units normalized to **18 decimals** |
| `reserveRatio`, `exitContribution` | Raw `uint32` fractions with denominator **1e8**; nullable |

Use the exported pure `normalizeReserveStats` helper for exact decimal strings. It preserves `null`, never converts bigint amounts to JavaScript numbers, and adds no rounding, locale formatting, `%` or currency labels:

```ts
import { normalizeReserveStats } from "@goodsdks/good-reserve"

const raw = await sdk.getReserveStats()
const normalized = normalizeReserveStats(raw)
// raw.reserveRatio = 50_000_000 -> normalized.reserveRatioPercent = "50"
// raw.exitContribution = 1_000_000 -> normalized.exitContributionPercent = "1"
// raw.poolReserveBalance = 1_000_000_000_000_000_000n
// -> normalized.poolReserveBalance = "1", even when stableTokenDecimals = 6
// normalized.poolTokenSupply also uses the normalized 18-decimal pool scale.
```

Percentage conversion is `raw / 1e6`, not `raw / 10000`. Slippage basis points use a separate `10000` denominator. Both pool amounts share the 18-decimal scale, so backing per G$ is their ratio. Continue using **token-native** decimals for wallet balances, quote input/output amounts and history events; do not apply pool scaling to those values.

## Chain support

**Celo** (`42220`) and **XDC** (`50`) support production and explicit development. Celo also supports staging; XDC staging is unavailable. `GoodReserveSDK.isChainEnvSupported(50, "production")` returns `true`. The constructor throws for unsupported chain/environment combinations rather than substituting development.

Production XDC's `mento-broker` route is:

| Contract | Address |
| --- | --- |
| Broker | `0x88de45906D4F5a57315c133620cfa484cB297541` |
| Exchange provider | `0x2fFBB49055d487DdBBb0C052Cd7c2a02A7971e41` |
| G$ | `0xEC2136843a983885AebF2feB3931F73A8eBEe50c` |
| USDC | `0xfA2958CB79b0491CC627c1557F441eF849Ca8eb1` |

The broker/provider addresses happen to match Celo's, but the chains and token pairs are **not interchangeable**. Pool discovery, reads, quotes, writes and history all use the selected chain/environment.

## Widget adoption (separate release dependency)

This patch targets **`@goodsdks/good-reserve` 0.1.4**. Publish/adopt that patched version (and a rebuilt compatible `@goodsdks/react-hooks` wrapper if used). The production widget must remove its development override and explicitly configure XDC chain `50` for both clients with `new GoodReserveSDK(publicClient, walletClient, "production")` or `useGoodReserve("production")`.

The widget must separately align its unit presentation and token metadata, invalidate quotes on route/direction/amount changes, ignore stale responses, and block execution until metadata and the current quote are valid. These SDK changes and the targeted demo corrections **do not change the external widget's configuration or UI and are not sufficient by themselves to release it**.

## ABI / Address source

Production XDC addresses were confirmed against `production-xdc` in this pinned GoodProtocol snapshot:
`https://github.com/GoodDollar/GoodProtocol/blob/8c7c8e0062df10183bcb3779a88a02fc848eef74/releases/deployment.json`

Existing Celo/development configuration and ABI references retain their original snapshot:
`https://github.com/GoodDollar/GoodProtocol/blob/04b5d250bc2802c7b04b7c4d87bc00222ea81e2b/releases/deployment.json`
`https://github.com/GoodDollar/GoodProtocol/blob/04b5d250bc2802c7b04b7c4d87bc00222ea81e2b/releases/deploy-settings.json`

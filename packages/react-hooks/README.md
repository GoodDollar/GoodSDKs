# GoodDollar React Hooks

`@goodsdks/react-hooks` bundles ready-to-use React hooks that wrap the core `@goodsdks/citizen-sdk` identity and claim clients, plus the `@goodsdks/good-reserve` reserve client. They streamline Wagmi integrations by wiring the required Viem clients and exposing state for loading and error handling.

## Installation

Install the hooks package alongside its peer dependencies:

```bash
yarn add @goodsdks/react-hooks @goodsdks/citizen-sdk wagmi viem
# or
npm install @goodsdks/react-hooks @goodsdks/citizen-sdk wagmi viem
```

> **Prerequisites:** React 18+, Wagmi v2, Viem v2, and a wallet connector configured via Reown/AppKit or a compatible provider.

## Quick Start

Wrap your app with the Wagmi provider of your choice, then call the hooks inside components. Each hook returns an object with `sdk`, `loading`, and `error` members so you can gate rendering while the underlying SDK initialises.
See an example wagmi configuration with reown's Appkit in the demo app: [WagmiConfig](https://github.com/GoodDollar/GoodSDKs/blob/main/apps/demo-identity-app/src/config.tsx)

```tsx
import { WagmiProvider } from "wagmi"
import { config } from "./wagmiConfig"
import {
  useIdentitySDK,
  useClaimSDK,
  useGoodReserve,
} from "@goodsdks/react-hooks"

const IdentityStatus = () => {
  const { sdk, loading, error } = useIdentitySDK("production")

  if (loading) return <p>Loading identity...</p>
  if (error || !sdk) return <p>Identity error: {error}</p>

  // sdk exposes viem-powered helpers from @goodsdks/citizen-sdk
  // e.g. sdk.getWhitelistedRoot(account)
  return <p>Identity SDK ready</p>
}

const ClaimButton = () => {
  const { sdk, loading, error } = useClaimSDK("production")

  if (loading) return <p>Preparing claim...</p>
  if (error || !sdk) return <p>Claim error: {error}</p>

  const onClaim = async () => {
    const receipt = await sdk.claim()
    console.log("Claimed UBI", receipt.transactionHash)
  }

  return <button onClick={onClaim}>Claim UBI</button>
}

const ReserveQuote = () => {
  const { sdk, loading, error } = useGoodReserve("production")

  if (loading) return <p>Loading reserve...</p>
  if (error || !sdk) return <p>Reserve error: {error}</p>

  return <p>Reserve stable token: {sdk.getStableTokenAddress()}</p>
}

export const App = () => (
  <WagmiProvider config={config}>
    <IdentityStatus />
    <ClaimButton />
    <ReserveQuote />
  </WagmiProvider>
)
```

## Hooks

- `useIdentitySDK(env?: contractEnv)`
  - Initialises the `IdentitySDK` using the active Wagmi public and wallet clients.
  - `env` defaults to `"production"` and accepts `"staging"` or `"development"`.
- `useClaimSDK(env?: contractEnv)`
  - Builds on `useIdentitySDK` and returns a ready `ClaimSDK` once identity checks resolve.
  - Surfaces entitlement errors via the returned `error` string.
- `useGoodReserve(env?: ReserveEnv, options?: GoodReserveSDKOptions)`
  - Returns a ready `GoodReserveSDK` for reserve quotes, approvals, buys, and sells on the active chain.
  - Returns `error` when the connected chain/env pair is unsupported, such as XDC on `production`.

### Streaming Hooks

- `useStreamingSDK({ environment, defaultToken })`
  - Returns `{ sdk, loading, error }` for components that want direct access to `StreamingSDK`.
- `useStreamList({ account, environment, first, skip, enabled })`
  - Fetches active streams for an account.
  - Supports merged pagination via `first` and `skip`.
- `useSuperTokenBalance({ account, token, environment, enabled })`
  - Fetches the current SuperToken snapshot balance for the selected token.
- `useBalanceHistory({ account, token, environment, first, skip, enabled })`
  - Fetches historical balance snapshots from the subgraph.
- `useFlowRate({ sender, receiver, token, environment, enabled })`
  - Reads the current live CFA flow rate directly from the forwarder.
- `usePoolMemberships({ account, enabled })`
  - Fetches GDA pool memberships for an account, including `isConnected` status (recommended for most UIs).
- `useSupReserves({ account, apiKey, enabled })`
  - Fetches SUP reserve holdings for the provided account. **Requires `apiKey`** (The Graph Gateway) on Base mainnet.
- `useCreateStream()`, `useUpdateStream()`, `useDeleteStream()`
  - Low-level mutators for managing 1-to-1 streams. Supports `token` as `TokenSymbol` ('G$' | 'SUP') or `Address`.
- `useSetStream()`
  - Recommended create-or-update mutation backed by `setFlowrate`.
- `useConnectToPool()`, `useDisconnectFromPool()`
  - Mutators for GDA pool memberships.

Both hooks re-run whenever the connected wallet, public client, or environment changes.
These hooks re-run whenever the connected wallet, public client, or environment changes.

## Demo & Further Reading

- Reference implementations: `apps/demo-identity-app` and `apps/demo-reserve-swap`.
- Core SDK details: `packages/citizen-sdk/README.md` and `packages/citizen-sdk/README-ClaimSDK.md`.
- Reserve SDK details: `packages/good-reserve/README.md`.

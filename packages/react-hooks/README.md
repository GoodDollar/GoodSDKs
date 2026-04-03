# GoodDollar React Hooks

`@goodsdks/react-hooks` bundles ready-to-use React hooks that wrap the core `@goodsdks/citizen-sdk` identity and claim clients. They streamline Wagmi integrations by wiring the required Viem clients and exposing state for loading and error handling.

## Installation

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
import { useIdentitySDK, useClaimSDK } from "@goodsdks/react-hooks"

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

export const App = () => (
  <WagmiProvider config={config}>
    <IdentityStatus />
    <ClaimButton />
  </WagmiProvider>
)
```

## Hooks

### Identity & Claim

- `useIdentitySDK(env?: contractEnv)`
  - Initialises the `IdentitySDK` using the active Wagmi public and wallet clients.
  - `env` defaults to `"production"` and accepts `"staging"` or `"development"`.
- `useClaimSDK(env?: contractEnv)`
  - Builds on `useIdentitySDK` and returns a ready `ClaimSDK` once identity checks resolve.
  - Surfaces entitlement errors via the returned `error` string.

Both hooks re-run whenever the connected wallet, public client, or environment changes.

### Wallet-Link (IdentityV4)

All wallet-link hooks live in a dedicated file (`wagmi-wallet-link-sdk.ts`) and are exported from the package root.

#### `useConnectAccount(sdk)`

Manages the connect-account flow including the security confirmation prompt.

```tsx
const { connect, loading, error, txHash, pendingSecurityConfirm, confirmSecurity, reset } =
  useConnectAccount(sdk)

// Trigger the flow - a confirmation dialog will appear via pendingSecurityConfirm
await connect("0xSecondaryWallet")

// Render the security prompt
if (pendingSecurityConfirm) {
  return (
    <div>
      <pre>{pendingSecurityConfirm.message}</pre>
      <button onClick={() => confirmSecurity(true)}>Confirm</button>
      <button onClick={() => confirmSecurity(false)}>Cancel</button>
    </div>
  )
}
```

#### `useDisconnectAccount(sdk)`

Same API as `useConnectAccount` but calls `disconnectAccount` on the SDK.

#### `useConnectedStatus(sdk, account?, chainId?, publicClients?)`

Fetches and watches wallet-link status. Omit `chainId` to query all supported chains. App-configured `publicClients` keyed by `SupportedChains` are used first when provided; otherwise the SDK reuses its active chain client and falls back to built-in read-only RPC clients for the other supported chains.

```tsx
import { createPublicClient, http } from "viem"
import { SupportedChains } from "@goodsdks/citizen-sdk"

const publicClients = {
  [SupportedChains.CELO]: createPublicClient({ transport: http("https://forno.celo.org") }),
  [SupportedChains.FUSE]: createPublicClient({ transport: http("https://rpc.fuse.io") }),
  [SupportedChains.XDC]: createPublicClient({ transport: http("https://rpc.ankr.com/xdc") }),
}

const { statuses, loading, error, refetch } = useConnectedStatus(
  sdk,
  "0xAccount",
  undefined,
  publicClients,
)

statuses.forEach(({ chainId, chainName, isConnected, root, error }) => {
  console.log(chainId, chainName, isConnected, root, error)
})
```

#### `useWalletLink(env?, watchAccount?, chainId?, publicClients?)`

Composite hook. Returns `{ sdk, sdkLoading, sdkError, connectAccount, disconnectAccount, connectedStatus }`. Reuses `useIdentitySDK` internally so there is a single SDK initialisation path.

```tsx
import { createPublicClient, http } from "viem"
import { SupportedChains } from "@goodsdks/citizen-sdk"

const publicClients = {
  [SupportedChains.CELO]: createPublicClient({ transport: http("https://forno.celo.org") }),
  [SupportedChains.FUSE]: createPublicClient({ transport: http("https://rpc.fuse.io") }),
  [SupportedChains.XDC]: createPublicClient({ transport: http("https://rpc.ankr.com/xdc") }),
}

const { connectAccount, disconnectAccount, connectedStatus } = useWalletLink(
  "production",
  "0xAccount",
  undefined,
  publicClients,
)

// connectAccount.connect(targetAddress)
// disconnectAccount.disconnect(targetAddress)
// connectedStatus.statuses[0].isConnected
```

The `reset()` helper on each action hook resets `loading`, `error`, `txHash`, and `pendingSecurityConfirm` together.

#### Switching chains before connect/disconnect

`connectAccount` and `disconnectAccount` act on the currently connected Wagmi wallet chain. If a user wants to perform a wallet-link action on another supported chain, switch first and let the hooks reinitialise with the new clients before sending the transaction.

```tsx
import { useChainId, useSwitchChain } from "wagmi"
import { SupportedChains } from "@goodsdks/citizen-sdk"
import { useWalletLink } from "@goodsdks/react-hooks"

const WalletLinkAction = () => {
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { connectAccount, sdkLoading } = useWalletLink("production", "0xAccount")

  const connectOnCelo = async () => {
    if (chainId !== SupportedChains.CELO) {
      await switchChainAsync({ chainId: SupportedChains.CELO })
      return
    }

    if (!sdkLoading) {
      await connectAccount.connect("0xSecondaryWallet")
    }
  }

  return <button onClick={connectOnCelo}>Connect on Celo</button>
}
```

If you want to keep the action in one click, wait until Wagmi finishes switching chains and `useWalletLink` has re-created the SDK for that chain before calling `connect` or `disconnect`.

## Demo & Further Reading

- Reference implementation: `apps/demo-identity-app` (Claim button + Wagmi/AppKit setup).
- Core SDK details: `packages/citizen-sdk/README.md` and `packages/citizen-sdk/README-ClaimSDK.md`.

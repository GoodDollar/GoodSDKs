# GoodDollar Identity SDK

`@goodsdks/citizen-sdk` provides typed Viem clients for interacting with GoodDollar identity contracts. Use it to verify wallets, check identity expiry, generate face verification links, and manage multi-wallet linking via the IdentityV4 wallet-link flow. React-specific bindings live in `@goodsdks/react-hooks`.

## Installation

```bash
yarn add @goodsdks/citizen-sdk viem
# or
npm install @goodsdks/citizen-sdk viem
```

## Getting Started

The SDK bootstraps from Viem public and wallet clients. Once initialised, you can access identity helpers and raw contract calls.

```ts
import { createPublicClient, createWalletClient, custom, http } from "viem"
import { IdentitySDK } from "@goodsdks/citizen-sdk"

const publicClient = createPublicClient({
  transport: http("https://forno.celo.org"),
})

const walletClient = createWalletClient({
  transport: custom(window.ethereum),
})

const identitySDK = await IdentitySDK.init({
  publicClient,
  walletClient,
  env: "production",
})

const { isWhitelisted } = await identitySDK.getWhitelistedRoot("0xYourAccount")

if (!isWhitelisted) {
  const link = await identitySDK.generateFVLink(false, "https://app.com/callback")
  console.log("Complete face verification at", link)
}
```

> `IdentitySDK.init` requires a wallet client with at least one connected account. The SDK uses it to sign face-verification payloads and submit transactions when necessary.

The SDK is intentionally **headless**: it always uses the `publicClient` and `walletClient` supplied by the integrating app. Transport configuration (custom headers, retry policy, authenticated RPCs, observability) is fully controlled at the application level and is never overridden by the SDK.

## Wallet-Link (Connect-a-Wallet)

IdentityV4 allows a whitelisted root identity to link secondary wallets so they share a single UBI claim.

### Connect a wallet

```ts
await identitySDK.connectAccount("0xSecondaryWallet", {
  onSecurityMessage: async (msg) => {
    return window.confirm(msg) // user must approve
  },
  onHash: (hash) => console.log("tx submitted:", hash),
})
```

### Disconnect a wallet

```ts
await identitySDK.disconnectAccount("0xSecondaryWallet", {
  skipSecurityMessage: true, // skip prompt for custodial/automated flows
})
```

### Check connection status

```ts
import { createPublicClient, http } from "viem"
import { SupportedChains } from "@goodsdks/citizen-sdk"

// Single chain — uses the app-provided publicClient directly
const [celoStatus] = await identitySDK.checkConnectedStatus(
  "0xAccount",
  SupportedChains.CELO,
)

// All chains — supply one app-configured client per chain so the SDK
// never creates its own clients (headless contract).
const publicClients = {
  [SupportedChains.CELO]: createPublicClient({ transport: http("https://forno.celo.org") }),
  [SupportedChains.FUSE]: createPublicClient({ transport: http("https://rpc.fuse.io") }),
  [SupportedChains.XDC]:  createPublicClient({ transport: http("https://rpc.ankr.com/xdc") }),
}

const statuses = await identitySDK.checkConnectedStatus("0xAccount", undefined, publicClients)
statuses.forEach(({ chainId, chainName, isConnected, root, error }) => {
  console.log(chainId, chainName, isConnected, root, error)
})
```

> Chains without a supplied client return `{ isConnected: false, error: "No public client provided for chain X" }` rather than silently skipping.

### WalletLinkOptions

| Option | Type | Description |
|--------|------|-------------|
| `skipSecurityMessage` | `boolean` | Skip the security confirmation entirely (use for custodial/automated flows). |
| `onSecurityMessage` | `(msg: string) => Promise<boolean>` | Called with the security notice; return `true` to proceed, `false` to cancel. When omitted the message is logged to `console.info`. |
| `onHash` | `(hash: \`0x${string}\`) => void` | Called with the transaction hash immediately after submission. |

### Custodial / Native wallet flows

For custodial signers (e.g. a `LocalAccount` private key), use `IdentityCustodialSDK` instead of `IdentitySDK`. It overrides `submitAndWait` to sign transactions directly without a wallet popup. Since `connectAccount` and `disconnectAccount` call `submitAndWait` internally, no additional changes are needed:

```ts
import { IdentityCustodialSDK } from "@goodsdks/citizen-sdk"

const sdk = new IdentityCustodialSDK({ account, publicClient, walletClient, env })
await sdk.connectAccount(secondaryWallet, { skipSecurityMessage: true })
```

## Read-Only Queries

When you only need to inspect contract state (for example, a backend service checking whether an address is whitelisted), bind the contract directly to a public client. The exported `chainConfigs` map exposes per-environment addresses.

```ts
import { createPublicClient, http } from "viem"
import {
  initializeIdentityContract,
  identityV2ABI,
  chainConfigs,
  SupportedChains,
} from "@goodsdks/citizen-sdk"

const publicClient = createPublicClient({
  transport: http("https://forno.celo.org"),
})

const identityAddress =
  chainConfigs[SupportedChains.CELO].contracts.production?.identityContract
if (!identityAddress) {
  throw new Error("Missing identity address for Celo production")
}

const contract = initializeIdentityContract(publicClient, identityAddress)

const root = await publicClient.readContract({
  address: contract.contractAddress,
  abi: identityV2ABI,
  functionName: "getWhitelistedRoot",
  args: ["0xUserAddress"],
})

const isWhitelisted = root !== "0x0000000000000000000000000000000000000000"
```

This path skips the wallet client entirely while still reusing the ABI and address helpers from the SDK package.

## Using with React

For Wagmi-based React projects, use the hooks exposed from `@goodsdks/react-hooks`. They wrap these Viem clients with loading/error state and should be the default integration layer for UI code. See `packages/react-hooks/README.md` for full guidance and examples.

## API Reference

- `IdentitySDK.init({ publicClient, walletClient, env })`
  - Creates an SDK instance using Viem clients and the desired GoodDollar environment (`"production" | "staging" | "development"`).
- `identitySDK.getWhitelistedRoot(address)`
  - Resolves the root identity for any address and reports whether it is currently whitelisted.
- `identitySDK.getIdentityExpiryData(address)`
  - Fetches the last authentication timestamp and period to calculate identity freshness.
- `identitySDK.generateFVLink(popupMode?, callbackUrl?, chainId?)`
  - Produces a face verification URL with optional popup behaviour and callback override.
- `identitySDK.calculateIdentityExpiry(lastAuthenticated, authPeriod)`
  - Utility for computing the expiry timestamp returned by `getIdentityExpiryData`.
- `identitySDK.submitAndWait(params, onHash?)`
  - Simulates and submits a transaction, awaiting its receipt while optionally reporting the hash.
- `identitySDK.connectAccount(account, options?)`
  - Links a secondary wallet to the caller's GoodDollar identity (IdentityV4). The whitelisted root must be the signer.
- `identitySDK.disconnectAccount(account, options?)`
  - Removes a secondary wallet from the caller's GoodDollar identity. Either the root or the connected account can call this.
- `identitySDK.checkConnectedStatus(account, chainId?, publicClients?)`
  - Per-chain wallet-link connection status. Provide `chainId` to scope to one chain; omit to query all chains. For all-chains queries supply app-configured `publicClients` keyed by `SupportedChains` to preserve the headless architecture.

Explore the generated TypeScript definitions in `dist/` for the complete surface, including helper enums (`contractEnv`, `SupportedChains`, etc.).

## Contract Addresses

### Celo
| Env | Address |
|-----|---------|
| production | `0xC361A6E67822a0EDc17D899227dd9FC50BD62F42` |
| staging | `0x0108BBc09772973aC27983Fc17c7D82D8e87ef4D` |
| development | `0xF25fA0D4896271228193E782831F6f3CFCcF169C` |

### Fuse
| Env | Address |
|-----|---------|
| production | `0x2F9C28de9e6d44b71B91b8BA337A5D82e308E7BE` |
| staging | `0xb0cD4828Cc90C5BC28f4920Adf2Fd8F025003D7E` |
| development | `0x1e006225cff7d37411db28f652e0Da9D20325eBb` |

### XDC
| Env | Address |
|-----|---------|
| production | `0x27a4a02C9ed591E1a86e2e5D05870292c34622C9` |
| development | `0xa6632e9551A340E8582cc797017fbA645695E29f` |

## References

- [Demo Identity App](https://demo-identity-app.vercel.app/)
- [Viem Documentation](https://viem.sh/)
- [GoodProtocol IdentityV2 Contract](https://github.com/GoodDollar/GoodProtocol/blob/master/contracts/identity/IdentityV2.sol)
- [GoodProtocol Deployment Addresses](https://github.com/GoodDollar/GoodProtocol/blob/master/releases/deployment.json)
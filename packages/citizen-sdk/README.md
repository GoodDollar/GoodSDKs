# GoodDollar Identity SDK

`@goodsdks/citizen-sdk` provides typed Viem clients for interacting with GoodDollar identity contracts. Use it to verify wallets, verify identity expiry, and generate face verification links. React-specific bindings now live in `@goodsdks/react-hooks`.

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
  const link = await identitySDK.generateFVLink(
    false,
    "https://app.com/callback",
  )
  console.log("Complete face verification at", link)
}
```

> `IdentitySDK.init` requires a wallet client with at least one connected account. The SDK uses it to sign face-verification payloads and submit transactions when necessary.

### Read-Only Queries

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
  throw new Error("Missing identity address for Fuse production")
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

Explore the generated TypeScript definitions in `dist/` for the complete surface, including helper enums (`contractEnv`, `SupportedChains`, etc.).

## Farcaster MiniApp Support

The SDK includes support for Farcaster miniapps, which enables proper navigation and callback handling when running inside a Farcaster miniapp environment.

### Configuration

**Important**: The `FarcasterAppConfigs` in `constants.ts` are placeholder values. If you're integrating the SDK into a Farcaster miniapp, you must update these with your actual Farcaster app ID and slug:

1. Go to the [Farcaster Developer Portal](https://warpcast.com/~/developers)
2. Register your Mini App and obtain your `appId` and `appSlug`
3. Update `FarcasterAppConfigs` in `packages/citizen-sdk/src/constants.ts` with your values for each environment (production, staging, development)

The SDK will automatically detect if it's running in a Farcaster miniapp and use Universal Links for callbacks, which ensures proper navigation back to your miniapp after face verification.

## References

- [Demo Identity App](https://demo-identity-app.vercel.app/)
- [Viem Documentation](https://viem.sh/)
- [GoodProtocol IdentityV2 Contract](https://github.com/GoodDollar/GoodProtocol/blob/master/contracts/identity/IdentityV2.sol)
- Celo identity addresses: development — `0xF25fA0D4896271228193E782831F6f3CFCcF169C`, staging — `0x0108BBc09772973aC27983Fc17c7D82D8e87ef4D`, production — `0xC361A6E67822a0EDc17D899227dd9FC50BD62F42`
- Fuse identity addresses: development — `0x1e006225cff7d37411db28f652e0Da9D20325eBb`, staging — `0xb0cD4828Cc90C5BC28f4920Adf2Fd8F025003D7E`, production — `0x2F9C28de9e6d44b71B91b8BA337A5D82e308E7BE`

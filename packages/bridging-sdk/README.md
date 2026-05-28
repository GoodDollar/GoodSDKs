# GoodDollar Bridging SDK

`@goodsdks/bridging-sdk` provides a comprehensive SDK for cross-chain G$ token bridging using Axelar and LayerZero protocols. The SDK supports bridging between Celo, Ethereum, Fuse, and XDC networks with proper fee estimation, transaction tracking, and decimal handling.

## Installation

```bash
yarn add @goodsdks/bridging-sdk viem
# or
npm install @goodsdks/bridging-sdk viem
```

For React applications, also install the peer dependencies:

```bash
yarn add @goodsdks/bridging-sdk @goodsdks/react-hooks wagmi viem
# or
npm install @goodsdks/bridging-sdk @goodsdks/react-hooks wagmi viem
```

## Quick Start

### Setup

```typescript
import { createPublicClient, createWalletClient, http, custom } from "viem"
import { celo } from "viem/chains"
import { BridgingSDK } from "@goodsdks/bridging-sdk"

const publicClient = createPublicClient({
  chain: celo,
  transport: http("https://forno.celo.org"),
})

const walletClient = createWalletClient({
  chain: celo,
  transport: custom(window.ethereum),
})

const sdk = new BridgingSDK(publicClient, walletClient)
```

### Recommended Bridging Flow

The SDK exposes a 3-step flow that handles balance checks, fee estimation, approvals, and the bridge transaction.

```typescript
import { parseUnits } from "viem"

// 1. Fetch the user's balances, allowance, and bridge fee in one call
const config = await sdk.getBridgeConfig("0xUserAddress")
// config: { g$Balance, nativeBalance, allowance, fee, bridgeLimits }

// 2. Get a validated quote — checks all requirements before submitting anything
const amount = parseUnits("10", 18) // 10 G$ from Celo (18 decimals)
const { quote, needsApproval, canBridge, requirements } = await sdk.getQuote(
  amount,
  42220,        // fromChain: Celo
  1,            // toChain:   Ethereum
  "0xRecipientAddress",
  "AXELAR",
  config.allowance
)

if (!canBridge) {
  // At least one blocking requirement failed (wrong chain, insufficient balance, etc.)
  console.error("Cannot bridge:", requirements.map(r => r.message))
  return
}

// needsApproval will be true if allowance < amount — doBridge handles this automatically
console.log("Needs approval first:", needsApproval)

// 3. Execute — handles ERC-20 approval (if needed) then submits the bridge transaction
const receipt = await sdk.doBridge(quote!, (status) => {
  switch (status.step) {
    case "approving":  console.log("Approving token spend..."); break
    case "bridging":   console.log("Submitting bridge transaction..."); break
    case "completed":  console.log("Done!", status.bridgeTxHash); break
    case "failed":     console.error("Failed:", status.error); break
  }
})

console.log("Bridge tx:", receipt.transactionHash)
```

### React Integration

Use `@goodsdks/react-hooks` for a Wagmi-integrated experience:

```tsx
import { useBridgingSDK, useBridgeFee, useBridgeHistory } from "@goodsdks/react-hooks"

const BridgeComponent = () => {
  const { sdk, loading, error } = useBridgingSDK()

  // Fee estimate for a specific route
  const { fee } = useBridgeFee(sdk, 42220, 1, "AXELAR")
  // fee.formatted → e.g. "0.0012 CELO"

  // Transaction history for the connected wallet
  const { history } = useBridgeHistory(sdk, "0xUserAddress")

  if (loading) return <p>Initializing SDK...</p>
  if (error || !sdk) return <p>Error: {error}</p>

  const handleBridge = async () => {
    const config = await sdk.getBridgeConfig("0xUserAddress")
    const { quote, canBridge } = await sdk.getQuote(
      10000000000000000000n, // 10 G$
      42220, 1, "0xRecipientAddress", "AXELAR",
      config.allowance
    )
    if (canBridge && quote) {
      await sdk.doBridge(quote)
    }
  }

  return <button onClick={handleBridge}>Bridge 10 G$ to Ethereum</button>
}
```

## API Reference

### Constructor

```typescript
new BridgingSDK(publicClient, walletClient?, chainId?)
```

Call `await sdk.initialize()` if you want to pre-warm the fee cache. `getBridgeConfig` does this automatically.

### Core Methods

#### `getBridgeConfig(address)`

Fetches balances, allowance, and fee data in one call.

```typescript
const config = await sdk.getBridgeConfig("0xUserAddress")
// Returns: { g$Balance, nativeBalance, allowance, fee, bridgeLimits }
```

#### `getQuote(amount, fromChain, toChain, recipient, protocol, currentAllowance)`

Validates a bridge request and returns a quote or a list of blocking requirements.

```typescript
const { quote, needsApproval, canBridge, requirements } = await sdk.getQuote(
  amount, 42220, 1, "0xRecipient", "AXELAR", config.allowance
)
// Returns: { quote: BridgeQuote | null, needsApproval: boolean, canBridge: boolean, requirements: BridgeRequirement[] }
```

#### `doBridge(quote, onStatus?)`

Executes a bridge. Automatically approves the token if needed before bridging.

```typescript
const receipt = await sdk.doBridge(quote, (status) => {
  // status.step: "approving" | "bridging" | "completed" | "failed"
})
```

### Supporting Methods

#### `estimateFee(targetChainId, protocol, fromChainId?)`

Returns the estimated native fee for a route.

```typescript
const estimate = await sdk.estimateFee(1, "AXELAR", 42220)
// Returns: { fee: bigint, feeInNative: string, protocol: "AXELAR" }
```

#### `getTransactionStatus(txHash, protocol)`

Polls the bridge explorer for transaction status.

```typescript
const status = await sdk.getTransactionStatus("0xTxHash", "AXELAR")
// Returns: { status: "pending" | "completed" | "failed", srcTxHash?, dstTxHash?, timestamp? }
```

#### `explorerLink(txHash, protocol)`

Returns a link to the bridge explorer.

```typescript
const link = sdk.explorerLink("0xTxHash", "LAYERZERO")
// "https://layerzeroscan.com/tx/0xTxHash"
```

#### `getHistory(address, options?)`

Fetches the combined BridgeRequest + ExecutedTransfer event history for an address on the current chain.

```typescript
const history = await sdk.getHistory("0xUserAddress")
```

#### Static Helpers

```typescript
BridgingSDK.formatChainName(42220)         // "Celo"
BridgingSDK.formatProtocolName("AXELAR")  // "Axelar"
BridgingSDK.getStatusLabel(status)         // "Pending" | "Completed" | "Failed"
BridgingSDK.getAllHistory(address, clients) // Cross-chain history using multiple public clients
```

## Error Handling

With the recommended flow, errors surface through `requirements` (pre-flight) or the `onStatus` callback (execution):

```typescript
// Pre-flight validation errors
const { canBridge, requirements } = await sdk.getQuote(...)
if (!canBridge) {
  requirements.forEach(r => console.error(r.type, r.message))
  // Types: "wrong_chain" | "insufficient_token_balance" | "insufficient_native_balance"
  //        | "insufficient_allowance" | "exceeds_limit" | "route_unavailable"
}

// Execution errors
await sdk.doBridge(quote, (status) => {
  if (status.step === "failed") console.error(status.error)
})
```

## Supported Chains

| Chain    | Chain ID | G$ Decimals | Native Currency |
|----------|----------|-------------|-----------------|
| Celo     | 42220    | 18          | CELO (18 dec)   |
| Ethereum | 1        | 2           | ETH (18 dec)    |
| Fuse     | 122      | 2           | FUSE (18 dec)   |
| XDC      | 50       | 18          | XDC (18 dec)    |

> **Note**: G$ decimals differ per chain. Bridge fees are always denominated in the source chain's **native currency** (18 decimals on all chains).

## Bridge Protocols

### Axelar
- Secure cross-chain communication
- Gas refunds supported
- Explorer: https://axelarscan.io

### LayerZero
- Ultra-light node endpoints
- Custom adapter parameters
- Explorer: https://layerzeroscan.com

## Best Practices

1. **Use the 3-step flow** — `getBridgeConfig → getQuote → doBridge` handles all edge cases
2. **Check `canBridge` before calling `doBridge`** — prevents failed transactions
3. **Use `onStatus` for UX feedback** — surfaces approval and bridging steps to the user
4. **Parse amounts with `parseUnits`** — use G$ decimals for the source chain (18 for Celo/XDC, 2 for ETH/Fuse)
5. **Show explorer links** — use `sdk.explorerLink(txHash, protocol)` for transparency

## Demo Application

See `apps/demo-bridging-app` for a complete end-to-end implementation.

## Contributing

Please read our [Contributing Guidelines](https://github.com/GoodDollar/GoodSDKs/blob/main/CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/GoodDollar/GoodSDKs/blob/main/LICENSE) file for details.
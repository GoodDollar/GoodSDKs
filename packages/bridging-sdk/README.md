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

No Wagmi dependency is needed. Load route configuration, update the amount, then refresh the final quote before submission.

```typescript
import { formatUnits, parseUnits, type Address } from "viem"

const sender: Address = "0xUserAddress" // Replace with the connected wallet
const route = { fromChain: 42220, toChain: 1, protocol: "AXELAR" as const }

// 1. Load source-chain limits and destination protocol fee configuration
const config = await sdk.getBridgeConfig(sender, route)
console.log(config.routeLimitsChainId, config.routeLimits, config.protocolFeeBps)

// 2. Amount changes reuse configuration, but balances/allowance/canBridge stay live
const params = { sender, ...route, amount: parseUnits("10", 18) }
await sdk.getQuote(params)
params.amount = parseUnits("20", 18)
const preview = await sdk.getQuote(params)
if (preview.quote) {
  console.log("Net G$ on Ethereum:", formatUnits(preview.quote.amountReceived, 2))
}

// 3. Explicitly refresh and use the refreshed quote for submission
const { quote, needsApproval, canBridge, requirements } = await sdk.getQuote({
  ...params,
  refresh: true,
})
if (!canBridge || !quote) {
  console.error("Cannot bridge:", requirements.map(r => r.message))
  return
}
console.log("Needs approval first:", needsApproval)
const receipt = await sdk.doBridge(quote, (status) => {
  if (status.step === "completed") {
    console.log("Source transaction confirmed:", status.bridgeTxHash)
  }
})

// Source confirmation is NOT destination delivery. Poll this separately.
const delivery = await sdk.getTransactionStatus(receipt.transactionHash, route.protocol)
console.log(delivery.status) // pending | completed (delivered) | failed
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
    const { quote, canBridge } = await sdk.getQuote({
      sender: "0xUserAddress",
      recipient: "0xRecipientAddress",
      amount: 10000000000000000000n, // 10 G$
      fromChain: 42220,
      toChain: 1,
      protocol: "AXELAR",
      refresh: true,
    })
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
new BridgingSDK(publicClient, walletClient?, chainId?, publicClients?)
```

The optional `publicClients: Record<number, PublicClient>` supplies destination RPC clients, e.g. `{ 1: ethereumPublicClient }`. Otherwise the SDK uses viem's default RPC for the destination chain. Supplied clients must match their chain IDs. Existing constructor calls remain valid.

Call `await sdk.initialize()` to pre-warm the GoodServer native-fee cache. Selecting a route in `getBridgeConfig` loads that data automatically.

### Core Methods

#### `getBridgeConfig(address, route?, { refresh? }?)`

Fetches current balances and allowance, source `bridgeLimits`, and the selected destination's `bridgeFees().fee`. Read failures reject the call.

```typescript
const route = { fromChain: 42220, toChain: 1, protocol: "AXELAR" as const }
const config = await sdk.getBridgeConfig("0xUserAddress", route)
// tokenBalance, nativeBalance, allowance, fees (GoodServer native estimates),
// routeLimits, routeLimitsChainId, protocolFeeBps, protocolFeeChainId
await sdk.getBridgeConfig("0xUserAddress", route, { refresh: true })
```

`routeLimits` describes the **source chain**, identified by `routeLimitsChainId`. Its `dailyLimit`, `txLimit`, `accountDailyLimit`, and `minAmount` are normalized G$ base units (**18 decimals**); `onlyWhitelisted` is a boolean. These are configured values, not remaining capacity or a dynamically calculated maximum. The address-only call remains supported and returns current-chain limits with null destination fee metadata.

Configuration is cached per selected source/destination/protocol route. Amount-only changes reuse it; switching routes (including switching back) reloads it. `{ refresh: true }` bypasses the configuration cache. A failed refresh invalidates that entry rather than falling back to stale or zero fees.

#### `getQuote({ sender, recipient?, amount, fromChain, toChain, protocol, refresh? })`

Validates a bridge request and returns a quote or a list of blocking requirements.

```typescript
const { quote, needsApproval, canBridge, requirements } = await sdk.getQuote({
  sender: "0xUserAddress",
  amount,
  ...route,
  refresh: true,
})
// Returns: { quote: BridgeFeeQuote | null, needsApproval, canBridge, requirements }
```

| Quote field | Units / meaning |
|-------------|-----------------|
| `amount` | Source-chain G$ base units |
| `fee` | Source native-currency base units; provider fee paid separately |
| `protocolFeeBps` | Destination `bridgeFees().fee` in basis points (10,000 = 100%) |
| `protocolFee` | G$ deducted from the transfer, in destination-token base units |
| `amountReceived` | Estimated net G$ received, in destination-token base units |

The SDK first converts `amount` to destination units (truncating on downscaling), calculates `protocolFee = destinationAmount * protocolFeeBps / 10_000` with integer division, then deducts it. It does **not** clamp the fee with stored `minFee`/`maxFee`, matching [MessagePassingBridge](https://github.com/GoodDollar/GoodBridge/blob/master/packages/bridge-contracts/contracts/messagePassingBridge/MessagePassingBridge.sol). No additional G$ balance or allowance is required for the protocol fee.

Every quote still checks balances, allowance, native provider fee, route availability, and live `canBridge(sender, amount)`. Failed configuration reads return a null quote with a `route_unavailable` requirement. Use `refresh: true` immediately before submission and submit **that returned quote**.

#### `doBridge(quote, onStatus?)`

Executes a bridge. Automatically approves the token if needed before bridging. The `completed` callback confirms the **source transaction only**; it does not confirm destination delivery. Track delivery separately with `getTransactionStatus`.

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

Queries the bridge explorer for destination delivery status; call repeatedly to poll. Explicit LayerZero `FAILED` and Axelar `failed` responses map to `failed`; missing/in-flight records remain `pending`.

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

> **Note**: G$ decimals differ per chain. Provider fees use the source chain's **native currency** (18 decimals); protocol fees and received amounts use destination-chain **G$** decimals.

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
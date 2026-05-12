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
yarn add @goodsdks/bridging-sdk wagmi viem
# or
npm install @goodsdks/bridging-sdk wagmi viem
```

## Quick Start

### Viem Integration

```typescript
import { createPublicClient, createWalletClient, http } from "viem"
import { celo, mainnet, fuse } from "viem/chains"
import { BridgingSDK } from "@goodsdks/bridging-sdk"

const publicClient = createPublicClient({
  chain: celo,
  transport: http("https://forno.celo.org"),
})

const walletClient = createWalletClient({
  chain: celo,
  transport: custom(window.ethereum),
})

const bridgingSDK = new BridgingSDK(publicClient, walletClient)

### Bridging Flow (Recommended)

The SDK provides a high-level 3-method flow that abstracts away the complexity of balance checks, fee estimation, and token approvals.

```typescript
// 1. Get base config (balances, fees, limits, allowance)
const config = await sdk.getBridgeConfig(userAddress)

// 2. Get a validated quote for a specific route
const { quote, needsApproval, canBridge, requirements } = await sdk.getQuote(
  amount,
  fromChainId,
  toChainId,
  recipient,
  "AXELAR",
  config.allowance
)

if (canBridge && quote) {
  // 3. Execute bridge (handles approval + bridge internally)
  await sdk.doBridge(quote, (status) => {
    console.log("Current step:", status.step) // 'approving' | 'bridging' | 'completed' | 'failed'
  })
} else {
  console.log("Cannot bridge:", requirements[0].message)
}
```

### Manual Methods

#### `canBridge(from, amount, targetChainId)`

Checks if an address can bridge a specified amount to a target chain based on on-chain limits.

```typescript
const result = await sdk.canBridge("0xUser", 1000n, 1)
// Returns: { isWithinLimit: boolean, error?: string }
```

#### `estimateFee(targetChainId, protocol, fromChainId?)`

Estimates the fee for bridging. Fees are paid in the source chain's native currency.

```typescript
const estimate = await sdk.estimateFee(1, "AXELAR")
// Returns: { fee: bigint, feeInNative: string, protocol: "AXELAR" }
```

#### `bridgeTo(target, targetChainId, amount, protocol)`

Generic bridge method. Note: Requires prior approval if allowance is insufficient.

```typescript
const receipt = await sdk.bridgeTo(recipient, 1, amount, "AXELAR")
```

### Transaction Tracking

#### `getTransactionStatus(txHash, protocol)`

Gets the status of a bridge transaction from external explorers.

```typescript
const status = await sdk.getTransactionStatus(txHash, "AXELAR")
// Returns: { status: "pending" | "completed" | "failed", ... }
```

#### `explorerLink(txHash, protocol)`

Generates an explorer link for a bridge transaction.

```typescript
const link = sdk.explorerLink(txHash, "LAYERZERO")
// "https://layerzeroscan.com/tx/0x..."
```

### React Hooks

Bridging hooks are provided via `@goodsdks/react-hooks`.

```tsx
const { sdk } = useBridgingSDK()
const { fee } = useBridgeFee(sdk, fromChain, toChain, protocol)
const { history } = useBridgeHistory(sdk, address)
```

### Utility Functions

#### Decimal Conversion

```typescript
import { normalizeAmount } from "@goodsdks/bridging-sdk"
import { formatUnits, parseUnits } from "viem"

// Normalize to 18-decimal format for limit checks
const normalized = normalizeAmount(amount, fromChainId)

// Format for display using viem
const formatted = formatUnits(1000000000000000000n, 18) // "1.0"

// Parse user input using viem
const parsed = parseUnits("1.5", 18) // 1500000000000000000n
```

#### Transaction Tracking

```typescript
// Get status via SDK method
const status = await sdk.getTransactionStatus(txHash, "AXELAR")
// Returns: { status: "pending" | "completed" | "failed", srcTxHash?, dstTxHash?, timestamp? }

// Get human-readable label
const label = BridgingSDK.getStatusLabel(status) // "Pending" | "Completed" | "Failed"
```

## Supported Chains

| Chain | Chain ID | Decimals | Native Currency |
|-------|-----------|----------|-----------------|
| Celo | 42220 | 18 | CELO |
| Ethereum | 1 | 2 | ETH |
| Fuse | 122 | 2 | FUSE |
| XDC | 50 | 18 | XDC |

## Bridge Protocols

### Axelar
- Secure cross-chain communication
- Gas refunds supported
- Explorer: https://axelarscan.io

### LayerZero
- Ultra-light node endpoints
- Custom adapter parameters
- Explorer: https://layerzeroscan.com

## Error Handling

The SDK provides detailed error messages for common issues:

```typescript
try {
  await sdk.bridgeTo(recipient, targetChain, amount, "AXELAR")
} catch (error) {
  if (error.message.includes("Insufficient fee")) {
    // Handle insufficient fee
  } else if (error.message.includes("limit")) {
    // Handle limit exceeded
  } else if (error.message.includes("balance")) {
    // Handle insufficient balance
  }
}
```

## Best Practices

1. **Call `sdk.initialize()` after construction** — fetches and caches fees so `bridgeTo` calls don't incur an extra round trip
2. **Check `canBridge` before submitting** — validates on-chain bridge limits for the user's amount
3. **Handle decimal conversions properly** — use `normalizeAmount` for limit checks, viem's `parseUnits`/`formatUnits` for display
4. **Track transaction status for user feedback** — poll `getTransactionStatus` and show the explorer link
5. **Provide explorer links for transparency** — use `sdk.explorerLink(txHash, protocol)`

## Demo Application

See the demo application at `apps/demo-bridging-app` for a complete implementation example.

## Contributing

Please read our [Contributing Guidelines](https://github.com/GoodDollar/GoodSDKs/blob/main/CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/GoodDollar/GoodSDKs/blob/main/LICENSE) file for details.
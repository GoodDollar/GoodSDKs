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

// Check if user can bridge
const canBridge = await bridgingSDK.canBridge(
  "0xUserAddress",
  1000000000000000000n, // 1 G$ (18 decimals for Celo)
  1 // Ethereum mainnet
)

if (canBridge.isWithinLimit) {
  // Estimate fee
  const feeEstimate = await bridgingSDK.estimateFee(1, "AXELAR")
  
  // Bridge tokens
  const receipt = await bridgingSDK.bridgeTo(
    "0xRecipientAddress",
    1, // Ethereum mainnet
    1000000000000000000n, // 1 G$
    "AXELAR",
    feeEstimate.fee // msg.value must cover the fee
  )
  
  console.log("Bridge transaction:", receipt.transactionHash)
}
```

### React Integration

```tsx
import { useBridgingSDK } from "@goodsdks/bridging-sdk"

const BridgeComponent = () => {
  const { sdk, loading, error } = useBridgingSDK()
  
  if (loading) return <p>Loading SDK...</p>
  if (error) return <p>Error: {error}</p>
  if (!sdk) return <p>SDK not initialized</p>
  
  const handleBridge = async () => {
    try {
      const feeEstimate = await sdk.estimateFee(1, "LAYERZERO")
      const receipt = await sdk.bridgeTo(
        "0xRecipientAddress",
        1, // Ethereum mainnet
        1000000000000000000n, // 1 G$
        "LAYERZERO",
        feeEstimate.fee
      )
      
      console.log("Bridge successful:", receipt.transactionHash)
    } catch (error) {
      console.error("Bridge failed:", error)
    }
  }
  
  return <button onClick={handleBridge}>Bridge 1 G$ to Ethereum</button>
}
```

## Core Concepts

### Decimal Handling

The SDK handles different decimal precision across chains:

- **Celo/XDC**: 18 decimals
- **Ethereum/Fuse**: 2 decimals

**Important**: Bridge operations use native token decimals, while limit checks use 18-decimal normalized amounts.

```typescript
import { normalizeAmount, denormalizeAmount } from "@goodsdks/bridging-sdk"

// For bridging from Celo (18 decimals) to Ethereum (2 decimals)
const bridgeAmount = 1000000000000000000n // 1 G$ in Celo decimals
const normalizedAmount = normalizeAmount(bridgeAmount, 42220) // Convert to 18 decimals
const ethereumAmount = denormalizeAmount(normalizedAmount, 1) // Convert to 2 decimals
```

### Fee Estimation

Fees are estimated using the GoodServer API and must be covered by `msg.value`:

```typescript
const feeEstimate = await sdk.estimateFee(targetChainId, "AXELAR")
console.log(`Fee: ${feeEstimate.feeInNative}`) // e.g., "4.8367843657257685 Celo"

// The fee must be provided as msg.value in the bridge transaction
await sdk.bridgeTo(recipient, targetChainId, amount, "AXELAR", feeEstimate.fee)
```

### Transaction Tracking

Track bridge transactions across chains:

```typescript
// Get transaction status
const status = await sdk.getTransactionStatus(txHash, "AXELAR")
console.log("Status:", status.status) // "pending" | "completed" | "failed"

// Get explorer link
const explorerLink = sdk.getExplorerLink(txHash, "AXELAR")
console.log("Explorer:", explorerLink) // https://axelarscan.io/gmp/0x...

// Get bridge history
const requests = await sdk.getBridgeRequests(userAddress)
const executed = await sdk.getExecutedTransfers(userAddress)
```

## API Reference

### BridgingSDK Class

#### Constructor

```typescript
new BridgingSDK(publicClient, walletClient?, chainId?)
```

#### Methods

##### `canBridge(from, amount, targetChainId)`

Checks if an address can bridge a specified amount to a target chain.

```typescript
const result = await sdk.canBridge(
  "0xUserAddress",
  1000000000000000000n,
  1 // Ethereum mainnet
)
// Returns: { isWithinLimit: boolean, error?: string }
```

##### `estimateFee(targetChainId, protocol)`

Estimates the fee for bridging to a target chain using a specific protocol.

```typescript
const estimate = await sdk.estimateFee(1, "AXELAR")
// Returns: { fee: bigint, feeInNative: string, protocol: "AXELAR" }
```

##### `bridgeTo(target, targetChainId, amount, protocol, msgValue?)`

Generic bridge method that automatically handles fee estimation and validation.

```typescript
const receipt = await sdk.bridgeTo(
  "0xRecipientAddress",
  1, // Ethereum mainnet
  1000000000000000000n, // 1 G$
  "AXELAR",
  feeEstimate.fee // Optional, will be estimated if not provided
)
```

##### `bridgeToWithLz(target, targetChainId, amount, adapterParams?, msgValue?)`

Bridge using LayerZero with custom adapter parameters.

```typescript
const receipt = await sdk.bridgeToWithLz(
  "0xRecipientAddress",
  1, // Ethereum mainnet
  1000000000000000000n, // 1 G$
  "0x000100000000000000000000000000000000000000000000000000000000000000060000", // Custom adapter params
  feeEstimate.fee
)
```

##### `bridgeToWithAxelar(target, targetChainId, amount, gasRefundAddress?, msgValue?)`

Bridge using Axelar with optional gas refund address.

```typescript
const receipt = await sdk.bridgeToWithAxelar(
  "0xRecipientAddress",
  1, // Ethereum mainnet
  1000000000000000000n, // 1 G$
  "0xRefundAddress", // Optional gas refund address
  feeEstimate.fee
)
```

##### `getBridgeRequests(address, options?)`

Fetches BridgeRequest events for an address.

```typescript
const requests = await sdk.getBridgeRequests("0xUserAddress", {
  fromBlock: 5000000n,
  limit: 100
})
```

##### `getExecutedTransfers(address, options?)`

Fetches ExecutedTransfer events for an address.

```typescript
const executed = await sdk.getExecutedTransfers("0xUserAddress", {
  fromBlock: 5000000n,
  limit: 100
})
```

##### `getTransactionStatus(txHash, protocol)`

Gets the status of a bridge transaction.

```typescript
const status = await sdk.getTransactionStatus(
  "0xTransactionHash",
  "AXELAR"
)
// Returns: { status: "pending" | "completed" | "failed", srcTxHash?, dstTxHash?, timestamp?, error? }
```

##### `getExplorerLink(txHash, protocol)`

Generates an explorer link for a bridge transaction.

```typescript
const link = sdk.getExplorerLink("0xTransactionHash", "LAYERZERO")
// Returns: "https://layerzeroscan.com/tx/0xTransactionHash"
```

### React Hooks

#### `useBridgingSDK()`

Hook for accessing the BridgingSDK instance.

```tsx
const { sdk, loading, error } = useBridgingSDK()
```

#### `useBridgeFee(fromChainId, toChainId, protocol)`

Hook for getting fee estimates.

```tsx
const { fee, loading, error } = useBridgeFee(42220, 1, "AXELAR")
```

#### `useBridgeTransactionStatus(txHash, protocol)`

Hook for tracking transaction status.

```tsx
const { status, loading, error } = useBridgeTransactionStatus("0xHash", "AXELAR")
```

### Utility Functions

#### Decimal Conversion

```typescript
import { 
  normalizeAmount, 
  denormalizeAmount, 
  formatAmount, 
  parseAmount 
} from "@goodsdks/bridging-sdk"

// Convert between native and normalized decimals
const normalized = normalizeAmount(amount, fromChainId)
const denormalized = denormalizeAmount(normalized, toChainId)

// Format for display
const formatted = formatAmount(1000000000000000000n, 18) // "1.0"

// Parse user input
const parsed = parseAmount("1.5", 18) // 1500000000000000000n
```

#### Fee Management

```typescript
import { 
  validateFeeCoverage, 
  validateSufficientBalance,
  formatFee 
} from "@goodsdks/bridging-sdk"

// Validate fee coverage
const validation = validateFeeCoverage(msgValue, requiredFee)

// Validate sufficient balance
const balanceCheck = validateSufficientBalance(
  userBalance, 
  bridgeAmount, 
  fee
)

// Format for display
const formatted = formatFee(fee, chainId)
```

#### Transaction Tracking

```typescript
import { 
  pollTransactionStatus, 
  formatTimestamp,
  getTimeElapsed,
  getStatusLabel 
} from "@goodsdks/bridging-sdk"

// Poll until completion
const finalStatus = await pollTransactionStatus(
  txHash, 
  "AXELAR",
  (status) => console.log("Status update:", status)
)

// Format for display
const timestamp = formatTimestamp(status.timestamp)
const elapsed = getTimeElapsed(status.timestamp)
const label = getStatusLabel(status)
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

1. **Always estimate fees before bridging**
2. **Validate user balance includes both amount and fees**
3. **Handle decimal conversions properly**
4. **Track transaction status for user feedback**
5. **Provide explorer links for transparency**

## Demo Application

See the demo application at `apps/demo-bridging-app` for a complete implementation example.

## Contributing

Please read our [Contributing Guidelines](https://github.com/GoodDollar/GoodSDKs/blob/main/CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/GoodDollar/GoodSDKs/blob/main/LICENSE) file for details.
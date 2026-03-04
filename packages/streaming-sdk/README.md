# @goodsdks/streaming-sdk

TypeScript SDK for Superfluid streams on Celo and Base, supporting G$ and SUP SuperTokens and GDA (General Distribution Agreement) pools.

## Features

- Auto-resolving token addresses (defaults to G$ on Celo, SUP on Base)
- Stream lifecycle: create, update, delete
- GDA pool connections
- Subgraph queries for balances and history
- SUP reserves query support (Base) via The Graph Gateway (requires `apiKey`)
- Multi-token support: G$ (Celo), SUP (Base)
- Environment-based address resolution (production/staging/development)

## Installation

```bash
yarn add @goodsdks/streaming-sdk viem
```

## Quick Start

```typescript
import { StreamingSDK, calculateFlowRate } from '@goodsdks/streaming-sdk'
import { createPublicClient, createWalletClient, http, parseEther } from 'viem'
import { celo } from 'viem/chains'

// Defaults to chain default token with production environment (G$ on Celo, SUP on Base)
const sdk = new StreamingSDK(publicClient, walletClient)

// Create stream (100 G$ per month)
const flowRate = calculateFlowRate(parseEther('100'), 'month')
await sdk.createStream({
  receiver: '0x...',
  flowRate
})
```

## Token Configuration

Defaults to chain default token (resolved from environment + chainId):

```typescript
// Uses chain default token (default)
const sdk = new StreamingSDK(publicClient, walletClient, {
  environment: 'production'
})

// Use SUP token
const sdk = new StreamingSDK(publicClient, walletClient, {
  defaultToken: 'SUP'
})

// Use custom token
const sdk = new StreamingSDK(publicClient, walletClient, {
  defaultToken: '0x...' as Address
})

// Override per operation
await sdk.createStream({
  receiver: '0x...',
  token: '0x...' as Address,
  flowRate: 1000n
})
```

## API Reference

### StreamingSDK

#### `createStream(params)`
Creates a new stream.

```typescript
await sdk.createStream({
  receiver: '0x...',
  flowRate: 1000n,
  token?: 'G$' | 'SUP' | Address,  // optional override
  userData?: '0x',
  onHash?: (hash) => console.log(hash)
})
```

#### `updateStream(params)`
Updates stream flow rate.

```typescript
await sdk.updateStream({
  receiver: '0x...',
  newFlowRate: 2000n,
  token?: 'G$' | 'SUP' | Address,
  userData?: '0x',
  onHash?: (hash) => console.log(hash)
})
```

#### `deleteStream(params)`
Deletes a stream.

```typescript
await sdk.deleteStream({
  receiver: '0x...',
  token?: 'G$' | 'SUP' | Address,
  userData?: '0x',
  onHash?: (hash) => console.log(hash)
})
```

#### `getActiveStreams(options)`
Returns active streams for an account.
```typescript
const streams = await sdk.getActiveStreams({
  account: '0x...',
  direction: 'outgoing' // 'incoming' | 'outgoing' | 'all'
})
```

#### `getSuperTokenBalance(account, token?)`
Returns balance for a SuperToken. Uses default token if `token` is omitted.
```typescript
const balance = await sdk.getSuperTokenBalance('0x...', 'SUP'?)
```

### GdaSDK

#### `connectToPool(params)`
Connects to a distribution pool.
```typescript
const gda = new GdaSDK(publicClient, walletClient)
await gda.connectToPool({
  poolAddress: '0x...',
  userData?: '0x',
  onHash?: (hash) => console.log(hash)
})
```

#### `disconnectFromPool(params)`
Disconnects from a distribution pool.
```typescript
await gda.disconnectFromPool({
  poolAddress: '0x...'
})
```

#### `getPoolMemberships(account)`
Returns pool memberships (including `isConnected`) for an account.
```typescript
const memberships = await gda.getPoolMemberships('0x...' as Address)
```

#### `getDistributionPools()`
Lists distribution pools for the connected chain.
```typescript
const pools = await gda.getDistributionPools()
```

## Supported Chains

| Token | Chain | Chain ID | Environment |
|-------|-------|----------|-------------|
| G$ | Celo | 42220 | production, staging, development |
| SUP | Base | 8453 | production |

## License

MIT

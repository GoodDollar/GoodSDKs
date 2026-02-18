# @goodsdks/streaming-sdk

TypeScript SDK for interacting with Superfluid streams on Celo and Base, specifically optimized for G$ SuperTokens and GDA (General Distribution Agreement) pools.

## Features

- **Stream Life-cycle**: Create, update, and delete 1-to-1 streams.
- **GDA Integration**: Connect/Disconnect from distribution pools.
- **Data Layer**: Subgraph-based querying for balances and history.
- **Auto-Resolution**: Automatically handles G$ token addresses for Celo.

## Installation

```bash
yarn add @goodsdks/streaming-sdk viem
```

## Quick Start

```typescript
import { StreamingSDK, calculateFlowRate } from '@goodsdks/streaming-sdk'
import { createPublicClient, createWalletClient, http, parseEther } from 'viem'
import { celo } from 'viem/chains'

const sdk = new StreamingSDK(publicClient, walletClient, {
  environment: 'production'
})

// Create a stream (100 G$ per month) - G$ token is auto-resolved!
const flowRate = calculateFlowRate(parseEther('100'), 'month')
await sdk.createStream({
  receiver: '0x...',
  flowRate
})
```

## API Reference

### StreamingSDK

#### `createStream(params)`
Create a new stream. G$ token is used by default if `token` is omitted.
```typescript
await sdk.createStream({
  receiver: '0x...',
  flowRate: 1000n,
  onHash: (hash) => console.log(hash)
})
```

#### `updateStream(params)`
Update an existing stream's flow rate.
```typescript
await sdk.updateStream({
  receiver: '0x...',
  newFlowRate: 2000n
})
```

#### `deleteStream(params)`
Delete a stream.
```typescript
await sdk.deleteStream({
  receiver: '0x...'
})
```

#### `getActiveStreams(account, direction?)`
Get active streams for an account.
```typescript
const streams = await sdk.getActiveStreams('0x...')
```

#### `getSuperTokenBalance(account)`
Get G$ SuperToken balance for an account.
```typescript
const balance = await sdk.getSuperTokenBalance('0x...')
```

### GdaSDK

#### `connectToPool(params)`
Connect to a distribution pool.
```typescript
const gda = new GdaSDK(publicClient, walletClient)
await gda.connectToPool({
  poolAddress: '0x...'
})
```

## Supported Chains

- **Celo** (Chain ID: 42220)
- **Base** (Chain ID: 8453)

## Environment Configuration

| Environment | G$ Resolution |
|-------------|------------------|
| production  | Auto-resolved |
| staging     | Auto-resolved |
| development | Auto-resolved |

## License

MIT

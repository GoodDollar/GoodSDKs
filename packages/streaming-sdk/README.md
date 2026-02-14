# @goodsdks/streaming-sdk

TypeScript SDK for managing Superfluid streams on Celo and Base networks. Provides a typed, modular API for creating, updating, and querying G$ money streams with GDA (General Distribution Agreement) pool support.

## Features

- 🌊 **Stream Management** - Create, update, and delete Superfluid streams
- 📊 **Subgraph Integration** - Query historical data and balances efficiently
- 🎯 **GDA Pools** - Connect/disconnect from distribution pools for 1-to-many streaming
- ⛓️ **Multi-Chain** - Support for Celo and Base networks
- 🔧 **Environment-Aware** - Dev/staging/production configuration
- 📘 **TypeScript** - Full type safety with comprehensive interfaces

## Installation

```bash
yarn add @goodsdks/streaming-sdk viem
```

## Quick Start

```typescript
import { StreamingSDK, GdaSDK, calculateFlowRate } from '@goodsdks/streaming-sdk'
import { createPublicClient, createWalletClient, http, parseEther } from 'viem'
import { celo } from 'viem/chains'

// Initialize clients
const publicClient = createPublicClient({
  chain: celo,
  transport: http()
})

const walletClient = createWalletClient({
  chain: celo,
  transport: http()
})

// Create SDK instance
const streamingSDK = new StreamingSDK(publicClient, walletClient, {
  chainId: 42220, // Celo
  environment: 'production'
})

// Create a stream (100 G$ per month)
const flowRate = calculateFlowRate(parseEther('100'), 'month')
const hash = await streamingSDK.createStream({
  receiver: '0x...',
  token: '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A', // G$ on Celo
  flowRate,
  onHash: (hash) => console.log('Transaction:', hash)
})
```

## API Reference

### StreamingSDK

Core SDK for stream operations.

#### Constructor

```typescript
new StreamingSDK(
  publicClient: PublicClient,
  walletClient?: WalletClient,
  options?: {
    chainId?: number
    environment?: 'production' | 'staging' | 'development'
  }
)
```

#### Methods

**createStream(params)**

Create a new stream.

```typescript
const hash = await streamingSDK.createStream({
  receiver: '0x...',
  token: '0x...',
  flowRate: BigInt('1000000000000000'), // wei per second
  onHash: (hash) => console.log(hash)
})
```

**updateStream(params)**

Update an existing stream's flow rate.

```typescript
const hash = await streamingSDK.updateStream({
  receiver: '0x...',
  token: '0x...',
  newFlowRate: BigInt('2000000000000000')
})
```

**deleteStream(params)**

Delete a stream.

```typescript
const hash = await streamingSDK.deleteStream({
  receiver: '0x...',
  token: '0x...'
})
```

**getActiveStreams(account, direction?)**

Get active streams for an account.

```typescript
// All streams
const streams = await streamingSDK.getActiveStreams('0x...')

// Incoming only
const incoming = await streamingSDK.getActiveStreams('0x...', 'incoming')

// Outgoing only
const outgoing = await streamingSDK.getActiveStreams('0x...', 'outgoing')
```

**getSuperTokenBalance(account)**

Get SuperToken balance for an account.

```typescript
const balance = await streamingSDK.getSuperTokenBalance('0x...')
console.log(`Balance: ${formatEther(balance)} G$`)
```

**getBalanceHistory(account, fromTimestamp?, toTimestamp?)**

Get historical balance data.

```typescript
const history = await streamingSDK.getBalanceHistory(
  '0x...',
  Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
  Date.now()
)
```

### GdaSDK

SDK for GDA (General Distribution Agreement) pool operations.

#### Constructor

```typescript
new GdaSDK(
  publicClient: PublicClient,
  walletClient?: WalletClient,
  chainId?: number
)
```

#### Methods

**connectToPool(params)**

Connect to a distribution pool.

```typescript
const gdaSDK = new GdaSDK(publicClient, walletClient, 42220)

const hash = await gdaSDK.connectToPool({
  poolAddress: '0x...',
  onHash: (hash) => console.log(hash)
})
```

**disconnectFromPool(params)**

Disconnect from a distribution pool.

```typescript
const hash = await gdaSDK.disconnectFromPool({
  poolAddress: '0x...'
})
```

**getDistributionPools()**

Get all distribution pools.

```typescript
const pools = await gdaSDK.getDistributionPools()
```

**getPoolMemberships(account)**

Get pool memberships for an account.

```typescript
const memberships = await gdaSDK.getPoolMemberships('0x...')
```

**getPoolDetails(poolId)**

Get details for a specific pool.

```typescript
const pool = await gdaSDK.getPoolDetails('0x...')
```

### Utility Functions

**calculateFlowRate(amountWei, timeUnit)**

Calculate flow rate from amount and time unit.

```typescript
import { calculateFlowRate } from '@goodsdks/streaming-sdk'
import { parseEther } from 'viem'

const flowRate = calculateFlowRate(parseEther('100'), 'month')
```

**formatFlowRate(flowRate, timeUnit)**

Format flow rate to human-readable string.

```typescript
import { formatFlowRate } from '@goodsdks/streaming-sdk'

const formatted = formatFlowRate(flowRate, 'month')
console.log(formatted) // "100 tokens/month"
```

**flowRateFromAmount(amount, timeUnit)**

Convenience function to calculate flow rate from string amount.

```typescript
import { flowRateFromAmount } from '@goodsdks/streaming-sdk'

const flowRate = flowRateFromAmount('100', 'month')
```

## Environment Configuration

The SDK supports three environments with different G$ token addresses:

```typescript
const sdk = new StreamingSDK(publicClient, walletClient, {
  environment: 'production' // or 'staging' or 'development'
})
```

| Environment | Celo G$ Address |
|-------------|-----------------|
| production  | `0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A` |
| staging     | `0x61FA0fB802fd8345C06da558240E0651886fec69` |
| development | `0xFa51eFDc0910CCdA91732e6806912Fa12e2FD475` |

## Supported Chains

- **Celo** (Chain ID: 42220) - Primary network for G$ operations
- **Base** (Chain ID: 8453) - SUP token operations

## Subgraph Queries

The SDK uses Superfluid subgraphs for efficient historical data queries:

```typescript
// Access the subgraph client directly
const subgraphClient = streamingSDK.getSubgraphClient()

// Query streams
const streams = await subgraphClient.queryStreams({
  account: '0x...',
  direction: 'all'
})

// Query balances
const balances = await subgraphClient.queryBalances('0x...')

// Query pool memberships
const memberships = await subgraphClient.queryPoolMemberships('0x...')

// Query SUP reserves
const reserves = await subgraphClient.querySUPReserves()
```

## Error Handling

```typescript
try {
  const hash = await streamingSDK.createStream({
    receiver: '0x...',
    token: '0x...',
    flowRate: BigInt('1000000000000000')
  })
} catch (error) {
  if (error.message.includes('Unsupported chain')) {
    console.error('Wrong network')
  } else if (error.message.includes('Wallet client not initialized')) {
    console.error('Connect wallet first')
  } else {
    console.error('Transaction failed:', error)
  }
}
```

## Examples

### Complete Stream Lifecycle

```typescript
import { StreamingSDK, calculateFlowRate } from '@goodsdks/streaming-sdk'
import { parseEther } from 'viem'

const sdk = new StreamingSDK(publicClient, walletClient)

// Create stream
const flowRate = calculateFlowRate(parseEther('100'), 'month')
await sdk.createStream({
  receiver: '0xReceiverAddress',
  token: '0xG$Address',
  flowRate
})

// Update stream
await sdk.updateStream({
  receiver: '0xReceiverAddress',
  token: '0xG$Address',
  newFlowRate: calculateFlowRate(parseEther('200'), 'month')
})

// Delete stream
await sdk.deleteStream({
  receiver: '0xReceiverAddress',
  token: '0xG$Address'
})
```

### GDA Pool Workflow

```typescript
import { GdaSDK } from '@goodsdks/streaming-sdk'

const gdaSDK = new GdaSDK(publicClient, walletClient, 42220)

// List all pools
const pools = await gdaSDK.getDistributionPools()

// Connect to a pool
await gdaSDK.connectToPool({
  poolAddress: pools[0].id
})

// Check membership
const memberships = await gdaSDK.getPoolMemberships('0xYourAddress')

// Disconnect from pool
await gdaSDK.disconnectFromPool({
  poolAddress: pools[0].id
})
```

## TypeScript Types

All types are exported for use in your application:

```typescript
import type {
  StreamInfo,
  CreateStreamParams,
  UpdateStreamParams,
  DeleteStreamParams,
  GDAPool,
  PoolMembership,
  SuperTokenBalance,
  Environment
} from '@goodsdks/streaming-sdk'
```

## License

MIT

## Related Packages

- [@goodsdks/react-hooks](../react-hooks) - React hooks for streaming operations
- [@goodsdks/citizen-sdk](../citizen-sdk) - GoodDollar identity and claim SDK
- [@goodsdks/savings-sdk](../savings-sdk) - G$ savings/staking SDK

## References

- [Superfluid Documentation](https://docs.superfluid.org)
- [Superfluid SDK](https://sdk.superfluid.pro)
- [GoodDollar Protocol](https://github.com/GoodDollar/GoodProtocol)

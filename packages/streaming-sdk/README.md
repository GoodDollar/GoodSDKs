# @goodsdks/streaming-sdk

TypeScript SDK for interacting with Superfluid streams on Celo and Base, specifically optimized for G$ SuperTokens and GDA (General Distribution Agreement) pools.

- **Stream Life-cycle**: Managed CRUD operations for 1-to-1 streams.
- **GDA Integration**: Support for Connecting/Disconnecting from distribution pools.
- **Data Layer**: Efficient subgraph-based querying for balances and history.
- **Security**: Strict environment-based configuration for dev, staging, and production.

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

// Create SDK instance with environment - G$ token is auto-resolved!
const streamingSDK = new StreamingSDK(publicClient, walletClient, {
  environment: 'production' // SDK automatically uses the correct G$ token
})

// Create a stream (100 G$ per month) - No token parameter needed!
const flowRate = calculateFlowRate(parseEther('100'), 'month')
const hash = await streamingSDK.createStream({
  receiver: '0x...',
  // Token is automatically resolved based on environment
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
    apiKey?: string // Optional: required for authenticated subgraphs like SUP Reserve
  }
)
```

#### Methods

**createStream(params)**

Create a new stream.

```typescript
const hash = await streamingSDK.createStream({
  receiver: '0x...',
  flowRate: BigInt('1000000000000000'), // wei per second
  onHash: (hash) => console.log(hash)
})
```

**updateStream(params)**

Update an existing stream's flow rate.

```typescript
const hash = await streamingSDK.updateStream({
  receiver: '0x...',
  newFlowRate: BigInt('2000000000000000')
})
```

**deleteStream(params)**

Delete a stream.

```typescript
const hash = await streamingSDK.deleteStream({
  receiver: '0x...'
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

| Environment | G$ Token Address |
|-------------|------------------|
| production  | Auto-resolved via `getG$Token()` |
| staging     | Auto-resolved via `getG$Token()` |
| development | Auto-resolved via `getG$Token()` |

## Token Auto-Resolution

**The SDK automatically resolves the G$ token address** based on your selected environment and chain. You don't need to specify the token parameter in stream operations:

```typescript
// Simplified API - token is auto-resolved
await sdk.createStream({
  receiver: '0x...',
  flowRate: calculateFlowRate(parseEther('100'), 'month')
})
```

**Advanced Usage:** If you need to use a custom token (not G$), you can still provide it explicitly:

```typescript
// Advanced: Using a custom SuperToken
await sdk.createStream({
  receiver: '0x...',
  token: '0xCustomSuperTokenAddress',
  flowRate: calculateFlowRate(parseEther('100'), 'month')
})
```

**Error Handling:** If G$ is not available for your chain/environment combination (e.g., Base network), you'll get a clear error message prompting you to either:
- Switch to a supported chain (Celo)
- Provide a custom token address explicitly

## Supported Chains

- **Celo** (Chain ID: 42220) - Primary network for G$ operations
- **Base** (Chain ID: 8453) - SUP token operations

## Address Resolution

To ensure compatibility and reliability, the Streaming SDK resolves Superfluid protocol addresses as follows:

- **Superfluid Context**: Addresses for the Host and CFA/GDA Forwarders are retrieved directly from the official `@sfpro/sdk` address maps (e.g., `cfaForwarderAddress[chainId]`).
- **G$ SuperTokens**: Token addresses are resolved based on the selected environment (`production`, `staging`, or `development`). On networks like Base where G$ is not yet deployed, the SDK gracefully handles the absence of the token.

## Subgraph Queries

The SDK uses Superfluid subgraphs for efficient historical data queries:

```typescript
const subgraphClient = streamingSDK.getSubgraphClient()

// Or initialize separately with an API Key for decentralized network access
const client = new SubgraphClient(SupportedChains.BASE, { 
    apiKey: 'your-graph-api-key' 
})

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

const sdk = new StreamingSDK(publicClient, walletClient, {
  environment: 'production'
})

// Create stream - token auto-resolved
const flowRate = calculateFlowRate(parseEther('100'), 'month')
await sdk.createStream({
  receiver: '0xReceiverAddress',
  flowRate
})

// Update stream
await sdk.updateStream({
  receiver: '0xReceiverAddress',
  newFlowRate: calculateFlowRate(parseEther('200'), 'month')
})

// Delete stream
await sdk.deleteStream({
  receiver: '0xReceiverAddress'
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

## Security & Best Practices

### API Key Management

If using authenticated subgraph endpoints (for SUP Reserve queries), provide your API key securely:

```typescript
const sdk = new StreamingSDK(publicClient, walletClient, {
  environment: 'production',
  apiKey: process.env.SUBGRAPH_API_KEY // Never hardcode keys
})
```

**Guidelines:**
- Always use environment variables for API keys
- Never commit keys to version control
- Rotate API keys regularly
- Use different keys for dev/staging/production

### Rate Limiting

Superfluid subgraph enforces rate limits:
- **Standard**: 100 queries per minute
- **Authenticated**: Higher limits with API key

To avoid rate limits:
```typescript
// Good: Batch queries
const [streams, pools, balances] = await Promise.all([
  sdk.getActiveStreams(account),
  gdaSDK.getDistributionPools(),
  sdk.getSuperTokenBalance(account)
])

// Avoid: Sequential queries
await sdk.getActiveStreams(account)
await gdaSDK.getDistributionPools()
await sdk.getSuperTokenBalance(account)
```

### Transaction Safety

Always validate before creating/updating streams:

```typescript
// Validate flow rate
if (newFlowRate <= 0n) {
  throw new Error("Flow rate must be positive")
}

// Check user has wallet connected
if (!walletClient) {
  throw new Error("Connect wallet first")
}

// Use onHash for user feedback
await sdk.createStream({
  receiver: recp,
  token: token,
  flowRate,
  onHash: (hash) => {
    console.log(`Transaction submitted: ${hash}`)
    // Show user transaction hash for tracking
  }
})
```

### Subgraph Data Freshness

Subgraph data may lag behind chain state by 1-2 blocks:

```typescript
// For critical operations, query both contract + subgraph
const subgraphStreams = await sdk.getActiveStreams(account)
// Optionally: read directly from contract for latest state
const contractState = await publicClient.readContract({
  address: cfaForwarder,
  abi: cfaForwarderAbi,
  functionName: 'getFlow',
  args: [token, sender, receiver]
})
```

### Error Handling

Implement proper error handling for network failures:

```typescript
import { StreamingSDK } from '@goodsdks/streaming-sdk'

try {
  const streams = await sdk.getActiveStreams(account)
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('network')) {
      // Handle network failure - retry with backoff
      console.error('Network error querying streams')
    } else if (error.message.includes('timeout')) {
      // Handle timeout
      console.error('Subgraph query timeout')
    } else {
      // Handle other errors
      console.error('Failed to fetch streams:', error.message)
    }
  }
}
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

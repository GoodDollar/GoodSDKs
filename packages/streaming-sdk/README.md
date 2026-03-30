# @goodsdks/streaming-sdk

TypeScript SDK for Superfluid streaming flows on Celo and Base, with GoodDollar-aware token resolution, GDA pool helpers, live CFA reads, and subgraph-backed historical queries.

## Features

- Stream lifecycle helpers for `create`, `update`, `delete`, and `createOrUpdate`
- Auto-resolved default tokens:
  - Celo -> `G$`
  - Base -> `SUP`
- Live CFA reads through the Superfluid forwarder (`getFlowRate`, `getFlowInfo`)
- Indexed stream, balance, balance-history, pool-membership, and reserve queries through the Superfluid subgraph
- GDA pool connect/disconnect helpers plus member-scoped pool listing and status queries
- Environment-aware token resolution for `production`, `staging`, and `development`

## Installation

```bash
yarn add @goodsdks/streaming-sdk viem
```

## Quick Start

```ts
import { StreamingSDK, calculateFlowRate } from "@goodsdks/streaming-sdk"
import { parseEther } from "viem"

const sdk = new StreamingSDK(publicClient, walletClient, {
  environment: "production",
})

const flowRate = calculateFlowRate(parseEther("100"), "month")

await sdk.createOrUpdateStream({
  receiver: "0x...",
  flowRate,
})
```

## Address Resolution

The SDK resolves addresses from two sources:

- Superfluid protocol forwarders come from `@sfpro/sdk` address maps.
  - `CFA_FORWARDER_ADDRESSES`
  - `GDA_FORWARDER_ADDRESSES`
- GoodDollar token addresses come from this package's environment maps.
  - `getG$Token(chainId, environment)`
  - `getSUPToken(chainId, environment)`

That means developers can usually initialize once with an environment and omit token addresses from individual calls:

```ts
const sdk = new StreamingSDK(publicClient, walletClient, {
  environment: "staging",
  defaultToken: "G$",
})
```

You can still override the token per call with either `"G$"`, `"SUP"`, or a raw token address.

## StreamingSDK

### Write methods

#### `createOrUpdateStream(params)`

Uses the recommended CFA forwarder `setFlowrate(token, receiver, flowRate)` path.

```ts
await sdk.createOrUpdateStream({
  receiver: "0x...",
  flowRate: 1500n,
  token: "G$",
})
```

Passing `0n` stops the stream.

#### `createStream(params)`

Low-level explicit `createFlow` wrapper. Prefer `createOrUpdateStream()` unless you specifically need the one-shot create call.

```ts
await sdk.createStream({
  receiver: "0x...",
  flowRate: 1000n,
  token: "G$",
  userData: "0x",
})
```

#### `updateStream(params)`

Low-level explicit `updateFlow` wrapper. Prefer `createOrUpdateStream()` unless you specifically need the separate update call.

```ts
await sdk.updateStream({
  receiver: "0x...",
  newFlowRate: 2000n,
  token: "G$",
  userData: "0x",
})
```

#### `deleteStream(params)`

```ts
await sdk.deleteStream({
  receiver: "0x...",
  token: "G$",
  userData: "0x",
})
```

### Live reads

#### `getFlowRate(params)`

Reads the current live flow rate directly from the CFA forwarder.

```ts
const flowRate = await sdk.getFlowRate({
  sender: "0x...",
  receiver: "0x...",
  token: "G$",
})
```

#### `getFlowInfo(params)`

Returns live flow metadata from the CFA forwarder.

```ts
const flowInfo = await sdk.getFlowInfo({
  sender: "0x...",
  receiver: "0x...",
  token: "G$",
})

console.log(flowInfo.flowRate, flowInfo.lastUpdated)
```

### Indexed subgraph reads

#### `getActiveStreams(options)`

Returns active streams from the Superfluid subgraph.

```ts
const streams = await sdk.getActiveStreams({
  account: "0x...",
  direction: "all",
})
```

Pagination is supported:

```ts
const streams = await sdk.getActiveStreams({
  account: "0x...",
  direction: "all",
  first: 20,
  skip: 20,
})
```

For `direction: "all"`, pagination is applied after outgoing and incoming results are merged and sorted by `createdAtTimestamp` descending. Internally, the SDK batches requests to avoid unbounded scans.

#### `getSuperTokenBalance(account, token?)`

```ts
const balance = await sdk.getSuperTokenBalance("0x...", "SUP")
```

If `token` is omitted, the SDK uses its configured default token.

#### `getBalanceHistory(options)`

Returns historical balance snapshots from the subgraph.

```ts
const history = await sdk.getBalanceHistory({
  account: "0x...",
  first: 10,
  skip: 0,
})
```

`fromTimestamp` / `toTimestamp` accept unix seconds, and millisecond inputs are normalized automatically.

### `getSubgraphClient()`

Use the underlying client for subgraph-only operations such as SUP reserve lookups.

## SUP Reserves

SUP reserve queries use The Graph Gateway endpoint and require an API key.

```ts
import { SubgraphClient, SupportedChains } from "@goodsdks/streaming-sdk"

const client = new SubgraphClient(SupportedChains.BASE, {
  apiKey: process.env.GRAPH_API_KEY,
})

const reserves = await client.querySUPReserves("0x...")
```

The reserve query is intentionally account-scoped. You must pass the wallet or account whose reserves you want to inspect.

## GdaSDK

#### `connectToPool(params)`

```ts
const gda = new GdaSDK(publicClient, walletClient)

await gda.connectToPool({
  poolAddress: "0x...",
  userData: "0x",
})
```

#### `disconnectFromPool(params)`

```ts
await gda.disconnectFromPool({
  poolAddress: "0x...",
  userData: "0x",
})
```

#### `getPoolMemberships(account)`

```ts
const memberships = await gda.getPoolMemberships("0x..." as Address)
```

#### `getDistributionPools(account)`

Lists only distribution pools where `account` is a member, including per-pool `isConnected` status for that account.

```ts
const pools = await gda.getDistributionPools("0x..." as Address)
```

#### `getPoolDetails(poolId, account)`

Looks up a specific pool within the queried account's distribution pools.

```ts
const pool = await gda.getPoolDetails("0xPool..." as Address, "0xAccount..." as Address)
```

## Supported Chains

| Token | Chain | Chain ID | Environment |
| --- | --- | --- | --- |
| G$ | Celo | 42220 | production, staging, development |
| SUP | Base | 8453 | production |

## License

MIT

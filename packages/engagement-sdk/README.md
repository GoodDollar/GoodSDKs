# GoodDollar Engagement SDK

`@goodsdks/engagement-sdk` wraps the on-chain [EngagementRewards](../engagement-contracts/contracts/EngagementRewards.sol) contract so apps can onboard reward programs, generate invite claims, and surface reward history. The package exposes low-level Viem utilities plus an optional Wagmi hook for React projects.

Contract ABIs and deployment artifacts are sourced from `@goodsdks/engagement-contracts`, which ships the deployment data for development and production on Celo.

## Installation

```bash
yarn add @goodsdks/engagement-sdk @goodsdks/engagement-contracts viem
# or
npm install @goodsdks/engagement-sdk @goodsdks/engagement-contracts viem
```

> React apps should also add `wagmi` to use the optional `useEngagementRewards` hook.

## Quick Start (Viem)

```ts
import { createPublicClient, http } from "viem"
import { createWalletClient, custom } from "viem"
import {
  EngagementRewardsSDK,
  REWARDS_CONTRACT,
} from "@goodsdks/engagement-sdk"

const publicClient = createPublicClient({
  transport: http("https://forno.celo.org"),
})

const walletClient = createWalletClient({
  transport: custom((window as any).ethereum), // swap with your wallet transport
})

const engagement = new EngagementRewardsSDK(
  publicClient,
  walletClient,
  REWARDS_CONTRACT,
  { cacheStorage: window.localStorage },
)

const pending = await engagement.getPendingApps()
console.log("Apps awaiting approval", pending.length)
```

Use `DEV_REWARDS_CONTRACT` when pointing at the development deployment.

### Registering and Managing Apps

```ts
import { zeroAddress } from "viem"

await engagement.applyApp(appAddress, {
  rewardReceiver: appAddress,
  userAndInviterPercentage: 80,
  userPercentage: 60,
  description: "Gamified savings quests for GoodDollar holders",
  url: "https://quests.goodapp.io",
  email: "ops@goodapp.io",
})

await engagement.approve(appAddress)

await engagement.updateAppSettings(appAddress, zeroAddress, 75, 55)

const current = await engagement.getAppInfo(appAddress)
console.log("Registered app meta", current)
```

### Issuing Rewards from Off-Chain Logic

Apps that run their invite or quest logic off-chain can pre-sign claims for users. The SDK helps with the EIP-712 payloads enforced by the contract.

```ts
const expirationBlock = (await engagement.getCurrentBlockNumber()) + 2_000n
const claimSig = await engagement.signClaim(
  appAddress,
  inviterAddress,
  expirationBlock,
)

await engagement.nonContractAppClaim(
  appAddress,
  inviterAddress,
  1n, // nonce managed by your server
  userSignature,
  claimSig,
)
```

## Consuming Reward Events

`rewardEvents = await engagement.getAppRewardEvents(app, options)` walks the chain for `RewardClaimed` logs, paginating in block batches and optionally caching progress with `localStorage` (or any `StorageLike` implementation) to avoid rehydrating the entire history each poll.

Key options:

- `blocksAgo` (default `500_000n`) constrains how far back the scan starts; set to `0n` to resume from cache only.
- `batchSize` controls block pagination; reduce to avoid RPC limits when running against small providers.
- `inviter` enables server-side filtering via indexed topics, skipping client-side post-processing.
- `cacheKey` / `disableCache` / `resetCache` fine-tune the persistence behaviour when multiple feeds coexist.

### Turning Events into a User Activity Feed

The `RewardEvent` objects expose the app, user, inviter, and individual reward splits. This enables rich UI features such as invite leaderboards or per-user reward timelines.

```ts
import type { RewardEvent } from "@goodsdks/engagement-sdk"

const events = await engagement.getAppRewardEvents(appAddress, {
  blocksAgo: 50_000n, // roughly ~2 days on Celo
})

const feed = events
  .sort((a, b) => Number(b.block - a.block))
  .slice(0, 25)
  .map((event) => ({
    tx: event.tx,
    label:
      `${event.user} earned ${event.userAmount} G$` +
      (event.inviterAmount > 0n
        ? ` (inviter ${event.inviter} received ${event.inviterAmount} G$)`
        : ""),
  }))

console.table(feed)
```

For dashboards that refresh frequently, pass a custom `cacheStorage` (e.g. Redis, file-backed store) so the SDK can persist the last processed block and fetch only new events. Pair the feed with `getAppRewards` to highlight aggregate totals alongside the timeline.

## React Usage

The package exports a simple Wagmi hook for apps that already provide `usePublicClient` and `useWalletClient` context:

```tsx
import { useEffect, useState } from "react"
import {
  useEngagementRewards,
  REWARDS_CONTRACT,
} from "@goodsdks/engagement-sdk"

const RewardsPanel = () => {
  const sdk = useEngagementRewards(REWARDS_CONTRACT, { debug: true })
  if (!sdk) return <p>Wallet not connected.</p>

  // When the hook resolves, render live stats
  const [stats, setStats] = useState()
  useEffect(() => {
    void sdk.getAppRewards(appAddress).then(setStats)
  }, [sdk])

  return <pre>{JSON.stringify(stats, null, 2)}</pre>
}
```

## API Highlights

- `new EngagementRewardsSDK(publicClient, walletClient, contract, options?)`
  - `options.cacheStorage` lets you plug in `localStorage`, Expo SecureStore, Redis, etc.
  - `options.debug` enables verbose logging around RPC batches and cache I/O.
- `applyApp`, `approve`, `updateAppSettings`
  - Wrap the core registration lifecycle enforced by the EngagementRewards contract.
- `getAppliedApps`, `getPendingApps`, `getRegisteredApps`
  - Convenience helpers that flatten the contract outputs.
- `nonContractAppClaim`, `signClaim`, `prepareClaimSignature`
  - Assist with signature-based claims for off-chain reward engines.
- `getAppRewardEvents(app, options)`
  - Streams reward history; combine with `GetAppRewardEventsOptions` to tailor pagination, caching, or inviter scoping.
- `getAppHistory`, `getAppRewards`
  - Fetch historical metadata changes and aggregate reward totals to accompany event feeds.

Type definitions (`RewardEvent`, `AppInfo`, `AppEvent`, etc.) are exported from the package for downstream typing.

## Contract Reference

- Source: `packages/engagement-contracts/contracts/EngagementRewards.sol`
- Deployment addresses: `@goodsdks/engagement-contracts/ignition/deployments`
- ABI generation command: `yarn workspace @goodsdks/engagement-contracts export-abis`

When GoodProtocol ships new deployments, regenerate the ABIs and bump this SDK so the helpers stay aligned with the on-chain schema.

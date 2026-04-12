# PR Review Responses

## 1. `packages/bridging-sdk/src/abi.ts` — Use `parseAbi` with only needed methods

**Reviewer:** Only include methods that are actually used, following the pattern in `citizen-sdk`.

**Fix:** Rewrote `abi.ts` to use `parseAbi` from viem with only the 5 functions and 2 events the SDK actually calls:
- `canBridge`, `bridgeLimits` (reads)
- `bridgeTo`, `bridgeToWithAxelar`, `bridgeToWithLzAdapterParams` (writes)
- `BridgeRequest`, `ExecutedTransfer` (events)

**Commit diff:** [`packages/bridging-sdk/src/abi.ts`](packages/bridging-sdk/src/abi.ts)

---

## 2. `packages/bridging-sdk/README.md` — Wrong `useBridgingSDK` package

**Reviewer:** `useBridgingSDK` is from `@goodsdks/react-hooks`, not `@goodsdks/bridging-sdk`.

**Fix:** Updated the React Integration example to import from `@goodsdks/react-hooks`.

**Commit diff:** [`packages/bridging-sdk/README.md`](packages/bridging-sdk/README.md)

---

## 3. `packages/bridging-sdk/README.md` — Out-of-date content (`denormalizeAmount`, `getExplorerLink`, extra `bridge` param)

**Reviewer:** README is out of date — `denormalizeAmount` doesn't exist in exports, `getExplorerLink` is wrong (method is `explorerLink`), and `bridgeTo` was shown with an extra fee param it doesn't take.

**Fix:**
- Removed `denormalizeAmount` (not exported; only `normalizeAmount` is).
- Renamed `getExplorerLink` → `explorerLink` throughout.
- Removed the extra `feeEstimate.fee` argument from all `bridgeTo`/`bridgeToWithLz`/`bridgeToWithAxelar` examples — the SDK handles fee internally.

**Commit diff:** [`packages/bridging-sdk/README.md`](packages/bridging-sdk/README.md)

---

## 4. `apps/demo-bridging-app/package.json` — Align versions with `demo-identity-app`

**Reviewer:** Align package versions with `demo-identity-app` where possible to reduce `yarn.lock` churn, and remove unused packages.

**Fix:**
- Aligned `@reown/appkit` and `@reown/appkit-adapter-wagmi` to `^1.7.2`.
- Aligned `react`/`react-dom` to `^18.3.1`.
- Aligned devDependencies: `typescript` → `^5.8.2`, `vite` → `6.3.5`, `@typescript-eslint/*` → `^5.62.0`, `@vitejs/plugin-react` → `^4.3.4`, `eslint` → `^8.57.1`.
- Added `@goodsdks/react-hooks` (used in `BridgeForm.tsx`) and `@tanstack/react-query` (used in `config.tsx`) which were missing.
- `viem` and `wagmi` are kept at v2 since the bridging SDK requires wagmi v2 APIs (vs v1 in the identity app).

**Commit diff:** [`apps/demo-bridging-app/package.json`](apps/demo-bridging-app/package.json)

---

## 5. `packages/bridging-sdk/src/viem-sdk.ts` — Cross-chain history sorted by chain-specific block numbers

**Reviewer:** Block numbers are chain-specific — combining all chains then sorting by `blockNumber` gives a wrong order.

**Fix:** Extracted a private static `_fetchChainHistory(address, publicClient, chainId, options)` helper. Each chain's events are sorted by block number within that chain. `getAllHistory` no longer applies a cross-chain sort — it flattens per-chain results in place.

**Commit diff:** [`packages/bridging-sdk/src/viem-sdk.ts`](packages/bridging-sdk/src/viem-sdk.ts) — `_fetchChainHistory` static method and updated `getAllHistory`

---

## 6. `packages/bridging-sdk/src/viem-sdk.ts` — `getAllHistory` creates new SDK instances per chain

**Reviewer:** Why initialize a new `BridgingSDK` per chain instead of passing `chainId` as a param?

**Fix:** `getAllHistory` now calls the private static `_fetchChainHistory` directly with the client and chainId from the `clients` map — no new `BridgingSDK` instances are created.

**Commit diff:** [`packages/bridging-sdk/src/viem-sdk.ts`](packages/bridging-sdk/src/viem-sdk.ts) — `getAllHistory` and `getHistory`

---

## 7. `packages/bridging-sdk/src/viem-sdk.ts` — `setWalletClient` overrides `currentChainId`

**Reviewer:** Overriding `this.currentChainId` to the wallet client's chain misaligns it with the `publicClient` used for reads.

**Fix:** Removed `this.currentChainId = walletClient.chain.id` from `setWalletClient`. `currentChainId` is now exclusively driven by the `publicClient` (set in the constructor).

**Commit diff:** [`packages/bridging-sdk/src/viem-sdk.ts`](packages/bridging-sdk/src/viem-sdk.ts) — `setWalletClient`

---

## 8. `apps/demo-bridging-app/src/components/BridgeForm.tsx` — Broken swap logic

**Reviewer:** `handleSwapChains` set `toChain = fromChain`, breaking routing. The swap button should trigger a wallet chain switch, and balance/fee display should follow.

**Fix:** `handleSwapChains` now calls `switchChain({ chainId: toChain })` via wagmi's `useSwitchChain`. When the wallet switches, `fromChain` (derived from `walletChainId`) updates automatically, `toChain` resets via the existing `useEffect`, and all fee/balance hooks re-fetch against the correct chains.

**Commit diff:** [`apps/demo-bridging-app/src/components/BridgeForm.tsx`](apps/demo-bridging-app/src/components/BridgeForm.tsx) — `handleSwapChains`

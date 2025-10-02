# GoodDollar Claim SDK

The Claim SDK ships with `@goodsdks/citizen-sdk` and builds on the Identity SDK to power Universal Basic Income (UBI) claim flows. It handles entitlement checks, faucet top-ups, and transaction submission across supported GoodDollar networks.

## Claim Flow at a Glance

1. **Verify identity** – confirm the wallet is whitelisted through the Identity SDK.
2. **Check entitlement** – determine the claimable amount on the active chain and look for fallbacks (Fuse ⇄ Celo ⇄ XDC).
3. **Trigger faucet (optional)** – tops up the claim contract if required.
4. **Submit claim** – send the `claim()` transaction and wait for confirmation.

```
User connects wallet
        ↓
IdentitySDK.getWhitelistedRoot
        ↓
Whitelisted? ── no ──▶ Face verification
        │
        yes
        ↓
ClaimSDK.checkEntitlement
        ↓
Can claim? ── no ──▶ nextClaimTime timer
        │
        yes
        ↓
ClaimSDK.claim ▶ receipt
```

## Viem Usage

initialise both SDKs manually with Viem clients:

```ts
import { createPublicClient, createWalletClient, custom, http } from "viem"
import { IdentitySDK, ClaimSDK, chainConfigs } from "@goodsdks/citizen-sdk"

const publicClient = createPublicClient({
  transport: http("https://forno.celo.org"),
})

const walletClient = createWalletClient({
  transport: custom(window.ethereum),
})

const identitySDK = await IdentitySDK.init({
  publicClient,
  walletClient,
  env: "production",
})

const claimSDK = await ClaimSDK.init({
  publicClient,
  walletClient,
  identitySDK,
  env: "production",
})

const { amount, altClaimAvailable, altChainId, altAmount } =
  await claimSDK.checkEntitlement()

if (amount > 0n) {
  const receipt = await claimSDK.claim()
  console.log("Claimed on current chain", receipt.transactionHash)
} else if (altClaimAvailable && altChainId && altAmount) {
  const altChain = chainConfigs[altChainId]
  console.log(
    `No allocation on the connected chain. ${altChain.label} exposes ${altAmount.toString()} wei.`,
  )

  // Optional: inspect the fallback chain without reconnecting the wallet
  const fallbackClient = createPublicClient({
    transport: http(altChain.rpcUrls[0]!),
  })

  const altEntitlement = await claimSDK.checkEntitlement({
    chainOverride: altChainId,
    publicClient: fallbackClient,
  })

  console.log(
    `Verified ${altEntitlement.amount.toString()} wei available on ${altChain.label}. Prompt the user to switch networks before claiming.`,
  )
} else {
  console.log("No UBI available right now; retry after nextClaimTime().")
}
```

> To execute a claim on the suggested fallback chain, prompt the wallet to
> switch networks and then re-run `ClaimSDK.init` so the SDK binds to that
> environment before calling `claimSDK.claim()` again.

## Using with React

For Wagmi-based React projects, use the hooks exposed from `@goodsdks/react-hooks`. They wrap these Viem clients with loading/error state and should be the default integration layer for UI code. See `packages/react-hooks/README.md` for full guidance and examples.

## API Highlights

- `ClaimSDK.init({ publicClient, walletClient, identitySDK, env })`
  - Convenience helper that derives the connected wallet address and returns a configured instance.
- `claimSDK.checkEntitlement(options?)`
  - Returns `{ amount, altClaimAvailable, altChainId, altAmount }`, probing fallback chains when necessary.
- `claimSDK.getWalletClaimStatus()`
  - Resolves the wallet's current state: `not_whitelisted`, `already_claimed`, or `can_claim`.
- `claimSDK.nextClaimTime()`
  - Computes when the wallet can claim again.
- `claimSDK.claim()`
  - Sends the UBI claim transaction, handling faucet triggers when balances are low.
- `claimSDK.getDailyStats()`
  - Fetches daily aggregate claimers and amounts.
- `claimSDK.triggerFaucet()` / `claimSDK.getFaucetParameters()`
  - Utilities for manual faucet top-ups where advanced control is required.
- `claimSDK.submitAndWait(params, onHash?)`
  - Low-level helper to simulate, submit, and await arbitrary contract calls against the active chain.

Refer to the generated TypeScript declarations in `packages/citizen-sdk/dist/` for the full surface, including types such as `ClaimSDKOptions` and `WalletClaimStatus`.

## Best Practices

- Check `identitySDK.getWhitelistedRoot` before instantiating the Claim SDK UI.
- Surface `altClaimAvailable` hints so users can switch to chains with available allocations.
- Provide loading and error states around every async interaction.
- Log transaction hashes and explorer links after a successful claim for supportability.
- Scope fallback RPC URLs using the provided helper utilities when deploying backend workers.

## References

- Demo claim flow: `apps/demo-identity-app`
- Identity SDK docs: `packages/citizen-sdk/README.md`
- React hooks guide: `packages/react-hooks/README.md`
- GoodProtocol contracts: https://github.com/GoodDollar/GoodProtocol

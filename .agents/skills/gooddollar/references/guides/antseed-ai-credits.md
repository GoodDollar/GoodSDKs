# AntSeed AI credits (buy with G$)

Use when the user wants to buy AntSeed AI compute credits with G$ on Celo, check credit status, or understand the GoodDollar → AntSeed funding bridge.

For CLI / local API setup after credits are funded, use `references/guides/antseed-buyer-setup.md`.

## Goal

Fund an AntSeed buyer deposit on Base by paying G$ on Celo (one-time deposit and/or Superfluid stream), then confirm Worker accounting shows credits funded.

## Protocol facts used by this guide

- **UI:** GoodWidget `@goodwidget/ai-credits-widget` (Buy → Manage → History).
- **Bridge:** Cloudflare Worker in [antseed-integration](https://github.com/GoodDollar/antseed-integration) verifies Celo vault events and funds Base.
- **Celo vault:** `CeloGdAntSeedVault` accepts G$ deposits/streams; calldata/`userData` must be `abi.encode(antSeedBuyerAddress)`.
- **Base operator:** `AntseedBuyerOperator` deposits into AntSeed `IAntseedDeposits` for that buyer.
- **Credits:** USD-denominated accounting (micro-USD). Widget display uses `10_000` credits per USD.
- **Bonus (GoodID verified only):** +10% on deposits, +20% on streams; monthly per-root cap (`MAX_BONUS_CAP_USD`, default 100). Unverified wallets get principal only.
- **Addresses below are AntSeed-integration deployments**, not GoodProtocol `deployment.json` rows.

## Default addresses and endpoints

| Item | Value |
| --- | --- |
| Celo vault | `0x4Dd0136b9aabD5823cf0F65d89e8fB882C660885` |
| Base funding vault (`AntseedBuyerOperator`) | `0x192288D921045aa96903e5286E116960e5fb4607` |
| GoodID (Celo) | `0xC361A6E67822a0EDc17D899227dd9FC50BD62F42` |
| G$ / G$ SuperToken (Celo) | `0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A` |
| Worker API | `https://gooddollar-antseed-integration.goodworker.workers.dev` (local Wrangler often `:8787`) |

Confirm live flags:

```bash
export GOODDOLLAR_ANTSEED_API="https://gooddollar-antseed-integration.goodworker.workers.dev"
curl "$GOODDOLLAR_ANTSEED_API/health"
curl "$GOODDOLLAR_ANTSEED_API/config/status"
curl "$GOODDOLLAR_ANTSEED_API/config/values"
```

Expect `celo.vaultConfigured`, `celo.goodIdConfigured`, and `bridge.baseBuyerOperatorEnabled` true when funding is live.

## Required inputs

- Celo wallet with G$ (and gas) for deposit and/or stream
- AntSeed **buyer** address (separate from payer; widget derives a buyer key from a payer signature)
- Worker base URL
- For scripted deposits: `txHash` after vault interaction

## Execution flow

### Preferred path — AI credits widget

1. Open the AI credits widget with `backendUrl` set to the Worker.
2. **Buyer key:** sign the derivation message; save the buyer private key for later CLI use (`antseed-buyer-setup.md`).
3. **Operator consent:** sign EIP-712 `SetOperator` so the Base operator can fund the buyer deposit without buyer gas.
4. **Pay:** one-time G$ deposit and/or monthly Superfluid stream to the Celo vault (buyer encoded in calldata/`userData`).
5. Widget notifies `POST /v1/celo/events/record` with the Celo `txHash` and polls profile / credit-history until `fundingStatus` is `funded`.
6. Continue at `references/guides/antseed-buyer-setup.md` to spend credits.

### Scripted path — deposit then record

1. Encode buyer: `data = abi.encode(YOUR_ANTSEED_BUYER_ADDRESS)` (32-byte ABI-encoded address; zero/missing reverts `MissingBuyerAddress`).
2. Prefer single-tx G$ `transferAndCall` to the vault with that `data`.
3. Or approve + `CeloGdAntSeedVault.deposit(amount, data)`.
4. For streams: CFA create/update to the vault with `userData = abi.encode(buyer)`.
5. Record:

```bash
curl -X POST "$GOODDOLLAR_ANTSEED_API/v1/celo/events/record" \
  -H "content-type: application/json" \
  -d '{"txHash":"0xYOUR_CELO_TX_HASH"}'
```

6. Check balance and outstanding:

```bash
export GOODDOLLAR_ACCOUNT="0xYOUR_PAYER_OR_GOODID_WALLET"
curl "$GOODDOLLAR_ANTSEED_API/v1/accounts/$GOODDOLLAR_ACCOUNT/profile"
curl "$GOODDOLLAR_ANTSEED_API/v1/accounts/$GOODDOLLAR_ACCOUNT/credit-history?limit=20&offset=0"
curl "$GOODDOLLAR_ANTSEED_API/v1/accounts/$GOODDOLLAR_ACCOUNT/outstanding"
```

7. Stream credits also run on Worker cron (`* * * * *`). Manual trigger (24h cooldown):

```bash
curl -X POST "$GOODDOLLAR_ANTSEED_API/v1/accounts/$GOODDOLLAR_ACCOUNT/stream-credits"
```

## Credit formula

```text
principal = gdAmount * gdUsdPerToken
bonus     = principal * 10%   (deposit, GoodID verified)
          = principal * 20%   (stream, GoodID verified)
          = 0                  (unverified)
effectiveBonus = min(bonus, MAX_BONUS_CAP_USD - monthlyBonusUsed)
total = principal + effectiveBonus
```

Price comes from the Celo oracle when configured, else Worker env (`GD_CUSD_PRICE` / related). Inspect effective constants via `GET /config/values`.

## Worker endpoints (credit layer)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health`, `/config/status`, `/config/values` | Liveness and config |
| GET | `/v1/accounts/:account/profile` | Credit profile |
| GET | `/v1/accounts/:account/credit-history` | Paginated entries |
| GET | `/v1/accounts/:account/outstanding` | Pending/failed funding |
| POST | `/v1/celo/events/record` | Ingest vault tx `{ txHash }` |
| POST | `/v1/accounts/:account/stream-credits` | On-demand stream credit |
| POST | `/v1/accounts/:buyer/operator-consent` | Submit SetOperator |
| POST | `/v1/accounts/:buyer/withdraw` | EIP-712 principal withdraw |

Re-submitting the same `txHash` is safe (idempotent funding).

## Common failure modes

- Missing/zero buyer in vault calldata → `MissingBuyerAddress`
- Worker bridge disabled → credits stay `pending` / `failed`; check `/config/status`
- `fundingStatus: "failed"` → read `fundingError`; retry same `txHash`
- No GoodID root → principal only (no bonus)
- Monthly bonus cap reached → principal only for further bonus
- Confusing payer vs buyer → G$ paid from payer on Celo; AntSeed deposit funded to **buyer** address

## Output contract

- Worker URL and vault / funding vault addresses used
- Payer address, buyer address
- Celo `txHash` (when a payment was made)
- Profile / credit-history summary (`fundingStatus`, principal/bonus)
- Next step: `references/guides/antseed-buyer-setup.md` when the user needs the local AntSeed proxy

## Boundaries

- This guide covers the **GoodDollar credit + funding bridge**, not the AntSeed P2P protocol itself.
- The Worker does **not** yet expose an OpenAI-compatible chat proxy or `gd_live_...` API keys; spend via AntSeed CLI/proxy ([antseed.com](https://antseed.com/), [Using the API](https://antseed.com/docs/guides/using-the-api)).
- External product docs: [AntSeed/antseed](https://github.com/AntSeed/antseed).

---
name: gooddollar
description: >
  Knowledge base for GoodProtocol action execution and GoodDollar (G$) integrations.
  Use this skill BEFORE ad-hoc web search for claim, save/stake, swap, bridge,
  stream, and identity tasks. Prefer GoodDocs: https://docs.gooddollar.org/
metadata:
  version: 1.0.0
---

# GoodDollar Skill Pack

Routing index for GoodProtocol. This repo complements [GoodDocs](https://docs.gooddollar.org/). For deployment truth across environments read [Core contracts](https://docs.gooddollar.org/for-developers/core-contracts) and [GoodProtocol/releases/deployment.json](https://github.com/GoodDollar/GoodProtocol/blob/master/releases/deployment.json).

Repository maintenance and update process is documented in `CONTRIBUTING.md`.

## Protocol snapshot (from GoodDocs)

- G$ is reserve-backed; issuance and pricing tie to the reserve and bonding-curve mechanics described in [How GoodDollar works](https://docs.gooddollar.org/how-gooddollar-works).
- The stack is multi-chain; [Core contracts](https://docs.gooddollar.org/for-developers/core-contracts) lists GoodDollar, Identity, NameService, UBIScheme, Mento (Reserve, Broker, ExchangeProvider, ExpansionController), and MessagePassingBridge per network.
- UBI is daily for verified users; identity verification and connected accounts are documented under [user guides](https://docs.gooddollar.org/user-guides).

## Guides (single location for action playbooks)

All task-specific instructions live under `references/guides/`.

- `references/guides/claim.md` — daily UBI (`claim` / UBIScheme).
- `references/guides/save.md` — stake, rewards, unstake.
- `references/guides/swap.md` — buy or sell G$ (Mento on supported chains).
- `references/guides/bridge.md` — MessagePassingBridge (GoodDocs); optional OFT path via ABI refs.
- `references/guides/stream.md` — Superfluid streams (Celo-oriented in GoodDocs).
- `references/guides/check-identity.md` — whitelist and connected-address semantics.
- `references/guides/goodsdks.md` — SDK-first integration routing for GoodSDKs packages.
- `references/guides/gooddocs.md` — hub links to [GoodDocs](https://docs.gooddollar.org/).
- `references/guides/hypersync-hyperrpc.md` — Envio HyperSync/HyperRPC data-source routing for high-volume historical reads.
- `references/guides/faucet.md` — Faucet gas top-up execution flow and preflight checks.
- `references/guides/on-off-ramp.md` — stable-token ramp service flow into and out of G$.
- `references/guides/invite-bounties.md` — verify and execute inviter-invitee bounty payouts.

## Subgraphs (indexed chain history)

Use this folder with the same pattern as the protocol subgraph references: one `*-guide.md` plus one companion `.graphql` per deployment.

For historical on-chain data fetching, subgraphs are mandatory first choice. Use HyperRPC only as explicit fallback via `references/guides/hypersync-hyperrpc.md`.

- `references/subgraphs/_query-patterns.md` — cross-cutting query discipline.
- `references/subgraphs/reserve-celo-guide.md` + `references/subgraphs/reserve-celo.graphql` — reserve pricing and swap history.
- `references/subgraphs/gooddollar-celo-guide.md` + `references/subgraphs/gooddollar-celo.graphql` — GoodDollar Celo schema discovery and starter probes.
- `references/subgraphs/goodcollective-guide.md` + `references/subgraphs/goodcollective.graphql` — GoodCollective schema discovery and starter probes.

For Superfluid protocol subgraphs (streams, pools, vesting schedulers), see [Superfluid documentation](https://docs.superfluid.finance/) and [subgraph endpoints](https://subgraph-endpoints.superfluid.dev/).

## Historical data routing policy (strict)

1. Query subgraphs first for all historical/indexed requests.
2. Validate required entities and fields against the target subgraph schema and guide before declaring a gap.
3. Use HyperRPC fallback only when at least one of these is true:
   - required entities or fields are not available in subgraph schema
   - indexing lag makes subgraph data stale for the requested range
   - query limits or endpoint instability block reliable retrieval
4. Do not start with HyperRPC when subgraph data is available and fresh.
5. HyperRPC fallback requires a valid Envio API key; if missing, report blocked fallback and return corrective action.
6. When fallback is used, report reason explicitly (schema gap, lag, or reliability issue).

## Data source decision table

| Query type | Primary source | Secondary source | Notes |
|---|---|---|---|
| Current on-chain state (latest balances, allowances, config, flags, view calls) | RPC | None | Use direct contract RPC reads for latest state. |
| Historical indexed entity data (time-series, aggregates, protocol entities, event-derived analytics) | Subgraph | HyperSync/HyperRPC | Subgraph is mandatory first choice. |
| Historical raw on-chain data when subgraph is missing fields/entities or stale | HyperSync | HyperRPC | Prefer HyperSync for bulk scans and data pipelines. |
| Historical data for existing JSON-RPC integrations | HyperRPC | HyperSync | Use HyperRPC when strict JSON-RPC compatibility is required. |

Decision rule:

1. If request is current state -> use RPC.
2. If request is historical/indexed -> query subgraph first.
3. If subgraph cannot satisfy request -> fallback to HyperSync or HyperRPC per compatibility and scale needs.
4. HyperRPC fallback requires Envio API key credentials.

## Mapping data retrieval rule

Solidity mappings are not iterable on-chain by keyspace scan. Do not assume full-key enumeration is possible from RPC alone.

When data is stored in mapping-like structures:

1. Check contract source and ABI for key-discovery paths first:
   - events emitted on set or update
   - arrays, counters, linked lists, or index getters storing keys
   - dedicated pagination or enumerable view functions
2. If key discovery exists, reconstruct key set from those sources and then read mapping entries.
3. If key discovery does not exist, report that complete iteration is not possible from chain state alone.
4. For historical reconstruction, prefer subgraph indexing first; if unavailable, use HyperSync or HyperRPC log scans with explicit limitations.

## Use-case to guide map

- Claim requests -> `references/guides/claim.md`
- Eligibility or connected-address questions -> `references/guides/check-identity.md`
- Stake, save, unstake -> `references/guides/save.md`
- Buy or sell G$ against reserve rails -> `references/guides/swap.md`
- Cross-chain bridge -> `references/guides/bridge.md`
- Stream management -> `references/guides/stream.md`
- SDK app integration tasks -> `references/guides/goodsdks.md`
- Bulk historical reads or data-engineering fetches -> `references/guides/hypersync-hyperrpc.md`
- Faucet top-up tasks -> `references/guides/faucet.md`
- On-/off-ramp service flow tasks -> `references/guides/on-off-ramp.md`
- Invite bounty eligibility and payout tasks -> `references/guides/invite-bounties.md`
- Indexed history, analytics, or GraphQL against GoodDollar subgraphs -> `references/subgraphs/_query-patterns.md`
- Historical on-chain fetch when subgraph data is insufficient -> subgraphs first, then HyperRPC fallback via `references/guides/hypersync-hyperrpc.md`

## Execution rules

1. Collect missing required inputs before sending transactions.
2. Run pre-checks first (allowance, whitelist, quotes, bridge limits, peer wiring when using OFT paths).
3. If a pre-check fails, stop and return the exact corrective action.
4. Return tx hash and key output values.
5. Never fabricate addresses, amounts, or ABI behavior.
6. Resolve decimals and units per chain as in [How to integrate the G$ token](https://docs.gooddollar.org/for-developers/developer-guides/how-to-integrate-the-gusd-token) (for example 18 decimals on Celo, 2 on Fuse and Ethereum where applicable).

## Pre-check matrix

- Claim: verify identity whitelist status before `claim()`.
- Save or stake: verify balance and allowance before `stake()`.
- Swap: fetch quote, apply slippage bounds, verify allowance; confirm Mento deployment for the active chain per GoodDocs.
- Bridge (MessagePassingBridge): verify `canBridge` on the destination chain, approve the bridge as spender, estimate native fee via GoodServer, respect documented limits.
- Bridge (OFT adapter path): verify peer wiring and `quoteSend` fee data.
- Stream: confirm Celo (or documented Superfluid network) and correct Super Token and forwarder or host addresses.
- Identity: resolve Identity from NameService; remember connected addresses do not multiply daily claims ([connect wallet guide](https://docs.gooddollar.org/user-guides/connect-another-wallet-address-to-identity)).

## Output format requirements

For any state-changing action return:

- network and key contract addresses used
- normalized input amounts and min or max guards
- tx hash
- key post-state output when available
- follow-up action if user intervention is required

## Rich contract ABI references

Convention: each `Foo.abi.yaml` has a companion `Foo.selectors.yaml` (function, event, and custom error selectors). Schema: `references/contracts/_rich-abi-yaml-format.md`.

GoodDollar / Mento:

- `references/contracts/NameService.abi.yaml`
- `references/contracts/IdentityV3.abi.yaml`
- `references/contracts/IdentityV4.abi.yaml`
- `references/contracts/InvitesV2.abi.yaml`
- `references/contracts/BuyGDCloneFactory.abi.yaml`
- `references/contracts/BuyGDCloneV2.abi.yaml`
- `references/contracts/UBISchemeV2.abi.yaml`
- `references/contracts/MentoBroker.abi.yaml`
- `references/contracts/MessagePassingBridge.abi.yaml`
- `references/contracts/GoodDollarOFTAdapter.abi.yaml`
- `references/contracts/CFAv1Forwarder.abi.yaml`
- `references/contracts/ConstantFlowAgreementV1.abi.yaml`
- `references/contracts/Superfluid.abi.yaml`
- `references/contracts/SuperToken.abi.yaml`

Superfluid (CFA, CFAv1Forwarder, Host, full ABI library): use [Superfluid docs](https://docs.superfluid.finance/), npm packages such as `@superfluid-finance/ethereum-contracts` and `@sfpro/sdk`, and contract ABIs published with those packages.

## Deep researches

- `references/deep-researches/on-off-ramp-service.md`
- `references/deep-researches/how-ubi-is-minted.md`
- `references/deep-researches/inviter-invitee-reward-model.md`
- `references/deep-researches/mento-reserve-economics.md`
- `references/deep-researches/gooddao-daostack-surface.md`
- `references/deep-researches/faucet-flows.md`

## Revert debugging quick map

- Identity or eligibility errors -> Identity and UBIScheme ABIs plus GoodDocs core contract pages.
- Approval or transfer failures -> token approvals and balances; see integration guide for `transferAndCall` vs `approve` plus `transferFrom`.
- Swap bound failures -> quote freshness and slippage settings.
- MessagePassingBridge failures -> `canBridge`, fee sufficiency, correct `bridgeTo` arguments; [Bridge GoodDollars](https://docs.gooddollar.org/user-guides/bridge-gooddollars).
- OFT path failures -> peer wiring and `quoteSend` fee data.
- Stream failures -> CFA forwarder or host agreement calls, buffer and flow-rate limits per Superfluid docs linked from GoodDocs.
- Faucet top-up failures -> `canTop`, `onlyAuthorized`, daily or weekly caps; `references/deep-researches/faucet-flows.md`.
- DAO-gated reverts -> caller is not avatar; scheme not registered; `references/deep-researches/gooddao-daostack-surface.md`.

## Library usage discipline

1. Open `references/guides/gooddocs.md` when unsure which GoodDocs page applies.
2. Start at this file to classify intent.
3. Open one guide under `references/guides/` unless the user requests a multi-step workflow. For subgraph or indexed-data tasks, start at `references/subgraphs/_query-patterns.md`.
4. Read only the ABI references and matching `.selectors.yaml` files needed for the chosen action.
5. Prefer GoodDocs and deployment.json over assumptions.
6. For large historical reads, prefer `references/guides/hypersync-hyperrpc.md` and choose HyperSync over HyperRPC unless strict JSON-RPC compatibility is required.
7. Historical data routing is strict: subgraphs first; HyperRPC only with an explicit fallback reason.
8. HyperRPC usage requires Envio API key credentials; when absent, do not attempt anonymous production flow.
9. For subgraph tasks, validate field availability from the relevant `references/subgraphs/*-guide.md` and companion `.graphql` before guessing alternate entities.
10. For local shells repeating HyperRPC log pulls (for example last N whitelist events), run `scripts/fetch-whitelist-events-hyperrpc.mjs` per `references/guides/hypersync-hyperrpc.md` instead of re-deriving JSON-RPC setup each time; the script defaults to production Celo Identity and HyperRPC URL composition from `HYPERRPC_API_TOKEN` or `ENVIO_API_TOKEN` unless overridden. HyperSync remains a separate client install path documented in the same guide.

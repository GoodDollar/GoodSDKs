# Envio HyperSync and HyperRPC

Use this guide when the task is high-volume historical blockchain data fetch (events, blocks, txs), especially analytics and indexing workflows.

## Official docs

- HyperSync overview: [docs.envio.dev/docs/HyperSync/overview](https://docs.envio.dev/docs/HyperSync/overview)
- HyperRPC overview: [docs.envio.dev/docs/HyperRPC/overview-hyperrpc](https://docs.envio.dev/docs/HyperRPC/overview-hyperrpc)
- HyperRPC supported networks: [docs.envio.dev/docs/HyperRPC/hyperrpc-supported-networks](https://docs.envio.dev/docs/HyperRPC/hyperrpc-supported-networks)

## What to use

- **HyperSync**: preferred for new data pipelines and heavy historical scans.
- **HyperRPC**: read-only JSON-RPC drop-in for existing RPC code paths.

## HyperRPC vs HyperSync (avoid mixing them up)

- **HyperRPC** is a **hosted JSON-RPC URL** (same methods as `eth_getLogs`, `eth_blockNumber`, and so on). Any HTTP client or existing RPC stack can call it; put the API token in the URL path as Envio documents.
- **HyperSync** is a **separate high-throughput query API** used through **Envio client libraries** (for example `@envio-dev/hypersync-client` in Node). It is **not** “just another RPC endpoint” with the same ergonomics as a one-line `fetch` to `eth_getLogs` at large scale.

## Decision rule

1. For GoodDollar protocol history that exists on subgraphs, query the subgraph first and validate fields in `references/subgraphs/*-guide.md`.
2. If subgraph schema or freshness cannot satisfy the request, use **HyperSync** for large scans and pipelines, or **HyperRPC** when you must stay inside standard JSON-RPC.
3. For write operations (sending tx), use normal RPC providers; HyperRPC is read-only.

## GoodDollar-relevant network coverage

- Celo and XDC are supported on HyperRPC.
- Fuse is not currently listed; treat this as non-blocking and use existing providers for Fuse.

## Access and auth

- HyperRPC/HyperSync usage is account-based.
- HyperRPC requires an API key for reliable production use.
- Requests without API token are rate-limited and should be treated as non-production fallback only.
- Add API key in endpoint URL as documented by Envio.
- HyperRPC token pattern example from docs: `https://<chain>.rpc.hypersync.xyz/<api-token>`

## Practical use in this repo

- Keep subgraphs as first option for indexed protocol entities.
- Use HyperSync/HyperRPC when subgraph coverage is missing, stale, or insufficient for bulk historical pulls.
- Keep contract truth and addresses from GoodProtocol, deployment.json, and GoodDocs.
- For implementation details (client setup, query structure, supported methods), follow the Envio docs links above directly.

## Prebuilt scripts (developers and local agents)

These scripts avoid rediscovering HyperRPC wiring on every task. They require **Node.js 18 or newer** (global `fetch`).

### Last N Identity `WhitelistedAdded` logs via HyperRPC

- Script: `scripts/fetch-whitelist-events-hyperrpc.mjs`
- Default `EVENT_TOPIC0` matches `WhitelistedAdded(address)` on `IdentityV4`; override `EVENT_TOPIC0` for other events.
- Production Celo defaults: `CONTRACT_ADDRESS` defaults to `Identity` from `production-celo` in [GoodProtocol deployment.json](https://github.com/GoodDollar/GoodProtocol/blob/master/releases/deployment.json) (`0xC361A6E67822a0EDc17D899227dd9FC50BD62F42`). If `HYPERRPC_URL` is unset, the script builds `https://celo.rpc.hypersync.xyz/<token>` from `HYPERRPC_API_TOKEN` or `ENVIO_API_TOKEN`.
- Optional env: `HYPERRPC_URL` (overrides token-based default), `CONTRACT_ADDRESS`, `LIMIT` (default `500`), `STEP` (default `2000`), `FROM_BLOCK` (default `0`), `TO_BLOCK` (default `latest`).

```bash
export HYPERRPC_API_TOKEN='<api-token>'
node scripts/fetch-whitelist-events-hyperrpc.mjs
```

Web-only assistants without a shell cannot run the file; they should return the same env keys and command text so the user runs it locally.

## HyperSync client minimal path (install required)

HyperSync uses the official client. Install and query pattern (Celo example URLs from [Envio Celo docs](https://docs.envio.dev/docs/HyperIndex/celo)):

```bash
npm install @envio-dev/hypersync-client
export ENVIO_API_TOKEN='<api-token>'
```

Save as a `.mjs` file (or use `"type": "module"` in a local `package.json`) and run with `node`:

```javascript
import { HypersyncClient, presetQueryLogsOfEvent } from "@envio-dev/hypersync-client";

const client = new HypersyncClient({
  url: "https://celo.hypersync.xyz",
  apiToken: process.env.ENVIO_API_TOKEN,
});

const identity = "0x...";
const whitelistedAddedTopic0 =
  "0xee1504a83b6d4a361f4c1dc78ab59bfa30d6a3b6612c403e86bb01ef2984295f";

const fromBlock = 0;
const toBlock = await client.getHeight();

const query = presetQueryLogsOfEvent(identity, whitelistedAddedTopic0, fromBlock, toBlock);
const res = await client.get(query);
console.log(res.data.logs.length);
```

Full API and streaming patterns: [HyperSync clients](https://docs.envio.dev/docs/HyperSync/hypersync-clients) and the package README for `@envio-dev/hypersync-client`.

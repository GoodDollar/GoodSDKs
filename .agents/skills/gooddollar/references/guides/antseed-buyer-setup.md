# AntSeed buyer API setup

Use when the user has (or will have) AntSeed credits funded via G$ and needs to run the local buyer proxy, set `ANTSEED_IDENTITY_HEX`, pin a peer, or point AI tools at AntSeed.

For buying/funding credits with G$, use `references/guides/antseed-ai-credits.md` first.

## Goal

Start the AntSeed buyer proxy with the **buyer private key** from the AI credits flow, pin a peer, and route compatible tools through `http://localhost:8377`.

## Protocol facts used by this guide

- Credits purchased with G$ fund an AntSeed **buyer deposit on Base** for the buyer address (not the G$ payer wallet).
- The widget derives a deterministic buyer key from a payer-wallet signature; that private key is `ANTSEED_IDENTITY_HEX`.
- AntSeed buyer proxy exposes OpenAI- and Anthropic-compatible APIs locally; payments settle from the on-chain buyer deposit.
- Until a peer is pinned, requests fail with `no_peer_pinned` (no auto-select).
- Canonical AntSeed docs: [Using the API](https://antseed.com/docs/guides/using-the-api), product: [antseed.com](https://antseed.com/), repo: [AntSeed/antseed](https://github.com/AntSeed/antseed).

## Required inputs

- Buyer private key hex from AI credits widget (Manage → API Setup / Buy → buyer key step)
- Node.js environment able to install `@antseed/cli`
- Optional: preferred peer id from `antseed network browse`

## Execution flow

1. Confirm credits are funded for this buyer (`antseed-ai-credits.md` profile / credit-history `fundingStatus: funded`).
2. Install CLI and export identity (never commit or paste the key into shared logs):

```bash
npm install -g @antseed/cli

export ANTSEED_IDENTITY_HEX=<buyer-private-key>
```

3. Start the buyer proxy (default port `8377`):

```bash
antseed buyer start
```

4. Discover and pin a peer (required before inference):

```bash
antseed network browse
antseed network peer <40-char-hex-peer-id>
antseed buyer connection set --peer <40-char-hex-peer-id>
```

Clear pins with `antseed buyer connection clear`.

5. Point tools at the local proxy (no AntSeed API key required; placeholder key is fine if a tool demands one):

```bash
export ANTHROPIC_BASE_URL=http://localhost:8377
claude
```

OpenAI-compatible:

```bash
curl http://localhost:8377/v1/chat/completions \
  -H "content-type: application/json" \
  -d '{
    "model": "deepseek-v3.1",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Anthropic-compatible:

```bash
curl http://localhost:8377/v1/messages \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-6",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

6. If the funded deposit is empty or spend fails for balance reasons, return to the AI credits widget (G$) or AntSeed’s own USDC deposit flow (`antseed payments` per AntSeed docs).

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm install -g @antseed/cli` | Install CLI |
| `export ANTSEED_IDENTITY_HEX=...` | Buyer identity for this credit balance |
| `antseed buyer start` | Local proxy on `:8377` |
| `antseed network browse` | List peers and services |
| `antseed network peer <id>` | Peer detail (pricing, protocols) |
| `antseed buyer connection set --peer <id>` | Pin peer for the session |
| `antseed buyer connection clear` | Clear pins |
| `antseed claude` | Claude Code via network (see AntSeed docs) |
| `antseed metrics serve --role buyer` | Buyer metrics exporter |

Per-request pin: header `x-antseed-pin-peer: <id>`, or model `<peer>@<model>`.

Isolated buyer data dir (multiple buyers / concurrent processes):

```bash
export BUYDIR="$HOME/.antseed-buyer-myapp"
mkdir -p "$BUYDIR"
ANTSEED_DATA_DIR="$BUYDIR" \
antseed --data-dir "$BUYDIR" buyer start \
  --peer <peer-id> \
  --port 8380
```

## Proxy endpoints

| Path | Format |
| --- | --- |
| `/v1/messages` | Anthropic Messages |
| `/v1/chat/completions` | OpenAI Chat Completions |
| `/v1/responses` | OpenAI Responses |

## Common failure modes

- Wrong key → identity does not match the funded buyer; regenerate/export the same buyer key from the widget for that payer
- `no_peer_pinned` → run browse + `buyer connection set`
- Empty deposit → buy more G$ credits or deposit USDC via AntSeed payments UI
- Stale buyer state → check data dir (`--data-dir` / `ANTSEED_DATA_DIR`); do not reuse one data dir across concurrent buyer processes
- Expecting Worker chat proxy → not implemented; use this local AntSeed proxy instead

## Output contract

- Confirm `ANTSEED_IDENTITY_HEX` is set (do not echo the secret)
- Proxy base URL and port
- Pinned peer id (if set)
- Tool env vars applied (`ANTHROPIC_BASE_URL` and/or OpenAI base URL)
- Link to [Using the API](https://antseed.com/docs/guides/using-the-api) for Codex profiles and advanced routing

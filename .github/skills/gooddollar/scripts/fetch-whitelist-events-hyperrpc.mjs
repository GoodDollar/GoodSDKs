const env = process.env;

const PRODUCTION_CELO_IDENTITY = "0xC361A6E67822a0EDc17D899227dd9FC50BD62F42";
const PRODUCTION_CELO_HYPERRPC_BASE = "https://celo.rpc.hypersync.xyz";

const hyperrpcToken = env.HYPERRPC_API_TOKEN || env.ENVIO_API_TOKEN;
const HYPERRPC_URL =
  env.HYPERRPC_URL ||
  (hyperrpcToken ? `${PRODUCTION_CELO_HYPERRPC_BASE}/${hyperrpcToken}` : null);
const CONTRACT_ADDRESS = env.CONTRACT_ADDRESS || PRODUCTION_CELO_IDENTITY;
const LIMIT = Number(env.LIMIT || 500);
const STEP = Number(env.STEP || 2000);
const EVENT_TOPIC0 =
  env.EVENT_TOPIC0 ||
  "0xee1504a83b6d4a361f4c1dc78ab59bfa30d6a3b6612c403e86bb01ef2984295f";
const TO_BLOCK_INPUT = env.TO_BLOCK || "latest";
const FROM_BLOCK_INPUT = env.FROM_BLOCK ?? "0";

if (!HYPERRPC_URL) {
  throw new Error(
    "Set HYPERRPC_URL or HYPERRPC_API_TOKEN or ENVIO_API_TOKEN for production Celo HyperRPC",
  );
}
if (!Number.isFinite(LIMIT) || LIMIT <= 0) {
  throw new Error("LIMIT must be a positive number");
}
if (!Number.isFinite(STEP) || STEP <= 0) {
  throw new Error("STEP must be a positive number");
}

const toHex = (n) => `0x${n.toString(16)}`;
const asAddress = (s) => s.toLowerCase();

const rpc = async (method, params) => {
  const res = await fetch(HYPERRPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Math.floor(Math.random() * 1e9),
      method,
      params,
    }),
  });
  if (!res.ok) {
    throw new Error(`RPC HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json.error) {
    throw new Error(`RPC ${json.error.code}: ${json.error.message}`);
  }
  return json.result;
};

const parseBlockHex = (hex) => Number.parseInt(hex, 16);

const decodeAddressTopic = (topic) => {
  if (!topic || topic.length < 66) return null;
  return `0x${topic.slice(26).toLowerCase()}`;
};

const blockToUnix = async (blockHex) => {
  const block = await rpc("eth_getBlockByNumber", [blockHex, false]);
  if (!block || !block.timestamp) return null;
  return parseBlockHex(block.timestamp);
};

const run = async () => {
  const latestHex = await rpc("eth_blockNumber", []);
  const latest = parseBlockHex(latestHex);

  const explicitTo =
    TO_BLOCK_INPUT === "latest" ? latest : Number.parseInt(TO_BLOCK_INPUT, 10);
  if (!Number.isFinite(explicitTo) || explicitTo < 0) {
    throw new Error("TO_BLOCK must be 'latest' or a non-negative decimal number");
  }

  const floor =
    FROM_BLOCK_INPUT == null ? 0 : Number.parseInt(FROM_BLOCK_INPUT, 10);
  if (!Number.isFinite(floor) || floor < 0) {
    throw new Error("FROM_BLOCK must be a non-negative decimal number");
  }

  const toBlock = Math.min(explicitTo, latest);
  const out = [];
  let cursorTo = toBlock;

  while (cursorTo >= floor && out.length < LIMIT) {
    const cursorFrom = Math.max(floor, cursorTo - STEP + 1);
    const logs = await rpc("eth_getLogs", [
      {
        address: asAddress(CONTRACT_ADDRESS),
        fromBlock: toHex(cursorFrom),
        toBlock: toHex(cursorTo),
        topics: [EVENT_TOPIC0],
      },
    ]);

    for (const log of logs) {
      out.push(log);
    }

    if (cursorFrom === floor) break;
    cursorTo = cursorFrom - 1;
  }

  out.sort((a, b) => {
    const bnA = parseBlockHex(a.blockNumber);
    const bnB = parseBlockHex(b.blockNumber);
    if (bnA !== bnB) return bnB - bnA;
    const liA = parseBlockHex(a.logIndex);
    const liB = parseBlockHex(b.logIndex);
    return liB - liA;
  });

  const sliced = out.slice(0, LIMIT);
  const rows = [];
  for (const log of sliced) {
    const from = decodeAddressTopic(log.topics?.[1]);
    const blockNumber = parseBlockHex(log.blockNumber);
    const timestamp = await blockToUnix(log.blockNumber);
    rows.push({
      txHash: log.transactionHash,
      blockNumber,
      logIndex: parseBlockHex(log.logIndex),
      account: from,
      timestamp,
    });
  }

  console.log(
    JSON.stringify(
      {
        source: "hyperrpc",
        url: HYPERRPC_URL,
        contract: asAddress(CONTRACT_ADDRESS),
        topic0: EVENT_TOPIC0,
        requestedLimit: LIMIT,
        returned: rows.length,
        toBlock,
        fromBlockFloor: floor,
        items: rows,
      },
      null,
      2,
    ),
  );
};

run().catch((e) => {
  console.error(String(e.message || e));
  process.exit(1);
});

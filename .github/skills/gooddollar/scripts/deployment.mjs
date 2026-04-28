#!/usr/bin/env node

const URL =
  "https://raw.githubusercontent.com/GoodDollar/GoodProtocol/master/releases/deployment.json";

async function fetchDeployment() {
  const res = await fetch(URL);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`deployment.json fetch failed: ${res.status} ${body}`.trim());
  }
  return res.json();
}

function pickNetwork(deployment, networkKey) {
  const obj = deployment[networkKey];
  if (!obj) return null;
  return obj;
}

function listNetworks(deployment) {
  const keys = Object.keys(deployment);
  const rows = keys.map((k) => {
    const n = deployment[k];
    const id = n && n.networkId != null ? n.networkId : null;
    return { key: k, network: n && n.network ? n.network : null, networkId: id };
  });
  return rows;
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(
      [
        "GoodSkills deployment resolver",
        "Commands:",
        "list",
        "resolve <networkKey> <contractKey>",
        "show <networkKey>",
      ].join("\n"),
    );
    return;
  }

  const deployment = await fetchDeployment();

  if (cmd === "list") {
    const rows = listNetworks(deployment);
    console.log(
      rows
        .map((r) => `${r.key}\t${r.network || ""}\t${r.networkId || ""}`.trimEnd())
        .join("\n"),
    );
    return;
  }

  if (cmd === "show") {
    const networkKey = args[0];
    if (!networkKey) throw new Error("Missing networkKey");
    const n = pickNetwork(deployment, networkKey);
    if (!n) throw new Error(`Unknown networkKey: ${networkKey}`);
    const keys = Object.keys(n).filter((k) => k !== "network" && k !== "networkId");
    console.log(
      JSON.stringify(
        {
          networkKey,
          network: n.network,
          networkId: n.networkId ?? null,
          contracts: keys,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (cmd === "resolve") {
    const networkKey = args[0];
    const contractKey = args[1];
    if (!networkKey || !contractKey)
      throw new Error("Usage: resolve <networkKey> <contractKey>");
    const n = pickNetwork(deployment, networkKey);
    if (!n) throw new Error(`Unknown networkKey: ${networkKey}`);
    const addr = n[contractKey];
    if (!addr) throw new Error(`Missing contractKey ${contractKey} in ${networkKey}`);
    console.log(JSON.stringify({ networkKey, contractKey, address: addr }, null, 2));
    return;
  }

  throw new Error(`Unknown command: ${cmd}`);
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : String(e));
  process.exit(1);
});


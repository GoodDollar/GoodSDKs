# Bridge guide

Use for moving G$ across supported networks with deployment-specific bridge contracts.

Primary local ABI reference for MessagePassingBridge flow:

- `references/contracts/MessagePassingBridge.abi.yaml`

## GoodDocs alignment

- User flow and high-level behavior: [Bridge GoodDollars](https://docs.gooddollar.org/user-guides/bridge-gooddollars).
- Resolve supported bridge contracts per chain from [Core contracts](https://docs.gooddollar.org/for-developers/core-contracts) and [deployment.json](https://github.com/GoodDollar/GoodProtocol/blob/master/releases/deployment.json).

## Goal

Bridge with deterministic pre-checks: bridge support, allowance, amount, fee.

## Required inputs

- source and destination chain metadata
- bridge contract address for source chain
- source G$ token address
- amount in source token decimals
- signer and rpc url

## Execution flow

1. Resolve source bridge and token addresses for the network pair.
2. Run bridge capability checks for the destination network when ABI provides this.
3. Read allowance and approve bridge spender when required.
4. Estimate fee if the bridge implementation requires message fee input.
5. Send bridge transaction with explicit min or guard values when supported.
6. Return tx hash and normalized bridge parameters.

## Deterministic snippet

```js
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const token = new ethers.Contract(
  process.env.GOODDOLLAR_ADDRESS,
  [
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
  ],
  signer,
);

const bridge = new ethers.Contract(
  process.env.BRIDGE_ADDRESS,
  [
    "function canBridge(uint32) view returns (bool)",
    "function bridgeTo(uint32,address,uint256) payable",
  ],
  signer,
);

const owner = await signer.getAddress();
const dstEid = Number(process.env.DST_EID);
const recipient = process.env.RECIPIENT;
const amount = ethers.parseUnits(process.env.AMOUNT, Number(process.env.DECIMALS));

const allowed = await bridge.canBridge(dstEid);
if (!allowed) throw new Error("Destination chain is not bridge-enabled");

const allowance = await token.allowance(owner, process.env.BRIDGE_ADDRESS);
if (allowance < amount) {
  const approveTx = await token.approve(process.env.BRIDGE_ADDRESS, amount);
  await approveTx.wait();
}

const tx = await bridge.bridgeTo(dstEid, recipient, amount, { value: 0n });
const receipt = await tx.wait();
console.log(
  JSON.stringify(
    {
      txHash: receipt.hash,
      sourceBridge: process.env.BRIDGE_ADDRESS,
      destinationEid: dstEid,
      recipient,
      amount: amount.toString(),
    },
    null,
    2,
  ),
);
```

## Failure handling

- unsupported destination: stop and return destination and source bridge
- fee too low: re-estimate and retry with user confirmation
- approval or balance issue: return required delta

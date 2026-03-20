# @goodsdks/good-reserve

SDK for buying and selling G$ through the GoodDollar reserve using viem.

The reserve runs on **Celo mainnet** and **XDC** (development environment currently has active swap endpoints; production-xdc currently does not expose reserve swap endpoints in deployment metadata).

## Installation

```bash
yarn add @goodsdks/good-reserve viem
```

## Usage

### Viem (framework-agnostic)

```ts
import { GoodReserveSDK } from "@goodsdks/good-reserve"
import { createPublicClient, createWalletClient, http } from "viem"
import { celo } from "viem/chains"

const publicClient = createPublicClient({ chain: celo, transport: http() })
const walletClient = createWalletClient({ chain: celo, transport: http() })

const sdk = new GoodReserveSDK(publicClient, walletClient, "production")

// Get a buy quote
const gdOut = await sdk.getBuyQuote(CUSD_ADDRESS, parseUnits("10", 18))

// Buy G$ with cUSD
const { hash: buyHash, receipt: buyReceipt } = await sdk.buy(
  CUSD_ADDRESS,
  parseUnits("10", 18),
  (gdOut * 95n) / 100n,
)

// Get a sell quote
const cusdOut = await sdk.getSellQuote(parseUnits("100", 2), CUSD_ADDRESS)

// Sell G$
const { hash: sellHash, receipt: sellReceipt } = await sdk.sell(
  CUSD_ADDRESS,
  parseUnits("100", 2),
  (cusdOut * 95n) / 100n,
)

// Fetch transaction history
const history = await sdk.getTransactionHistory(account)
```

### React / Wagmi

```tsx
import { useGoodReserve } from "@goodsdks/react-hooks"

function ReserveButton() {
  const { sdk, loading, error } = useGoodReserve("production")

  const handleBuy = async () => {
    if (!sdk) return
    await sdk.buy(CUSD_ADDRESS, parseUnits("10", 18), 0n)
  }

  return <button onClick={handleBuy}>Buy G$</button>
}
```

## API

### Initialization Options

The `GoodReserveSDK` constructor accepts an `options` object as its fourth argument.

- `exactApproval` (`boolean`, default: `true`): When `true`, buy/sell transactions approve only the exact token amount required for the swap. Set to `false` to approve an infinite amount (`maxUint256`). While `false` reduces gas costs on future swaps, it is less secure.

### `GoodReserveSDK`

| Method                                       | Description                                         |
| -------------------------------------------- | --------------------------------------------------- |
| `getBuyQuote(tokenIn, amountIn)`             | Returns estimated G$ output for a given token input |
| `getSellQuote(gdAmount, sellTo)`             | Returns estimated token output for a given G$ input |
| `getGDBalance(account)`                      | Returns G$ balance of an account                    |
| `getTransactionHistory(account, options?)`   | Returns past buy/sell events for an account         |
| `buy(tokenIn, amountIn, minReturn, onHash?)` | Approves and buys G$                                |
| `sell(sellTo, gdAmount, minReturn, onHash?)` | Approves and sells G$                               |

## Chain support

**Celo** (`42220`) and **XDC** (`50`) are supported. The constructor throws if initialized on an unsupported chain, or on an environment where the reserve hasn't been deployed yet (e.g. `production` on XDC).

## ABI / Address source

Addresses and ABIs are pinned to this GoodProtocol snapshot:
`https://github.com/GoodDollar/GoodProtocol/blob/04b5d250bc2802c7b04b7c4d87bc00222ea81e2b/releases/deployment.json`
`https://github.com/GoodDollar/GoodProtocol/blob/04b5d250bc2802c7b04b7c4d87bc00222ea81e2b/releases/deploy-settings.json`

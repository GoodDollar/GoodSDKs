# @goodsdks/good-reserve

SDK for buying and selling G$ through the GoodDollar reserve using viem.

The reserve runs on **Celo mainnet** via the Mento protocol. Contract addresses are sourced from the canonical [GoodProtocol deployment.json](https://github.com/GoodDollar/GoodProtocol/blob/master/releases/deployment.json).

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
await sdk.buy(CUSD_ADDRESS, parseUnits("10", 18), gdOut * 95n / 100n)

// Get a sell quote
const cusdOut = await sdk.getSellQuote(parseUnits("100", 2), CUSD_ADDRESS)

// Sell G$
await sdk.sell(CUSD_ADDRESS, parseUnits("100", 2), cusdOut * 95n / 100n)

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

### `GoodReserveSDK`

| Method | Description |
|--------|-------------|
| `getBuyQuote(tokenIn, amountIn)` | Returns estimated G$ output for a given token input |
| `getSellQuote(gdAmount, sellTo)` | Returns estimated token output for a given G$ input |
| `getGDBalance(account)` | Returns G$ balance of an account |
| `getTransactionHistory(account, options?)` | Returns past buy/sell events for an account |
| `buy(tokenIn, amountIn, minReturn, onHash?)` | Approves and buys G$ |
| `sell(sellTo, gdAmount, minReturn, onHash?)` | Approves and sells G$ |

## Chain support

Only **Celo** (chainId `42220`) is supported. The constructor throws if a non-Celo client is provided.

## ABI / Address source

Addresses pinned to:
`https://github.com/GoodDollar/GoodProtocol/blob/master/releases/deployment.json`
(`production-celo` network)

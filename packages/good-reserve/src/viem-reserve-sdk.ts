import {
  type Address,
  type PublicClient,
  type WalletClient,
  type TransactionReceipt,
  type SimulateContractParameters,
} from "viem"
import { waitForTransactionReceipt } from "viem/actions"
import {
  RESERVE_CONTRACT_ADDRESSES,
  CELO_CHAIN_ID,
  XDC_CHAIN_ID,
  getReserveChainFromId,
  type ReserveChainConfig,
  exchangeHelperABI,
  buyGDFactoryABI,
  mentoBrokerABI,
  mentoExchangeProviderABI,
  erc20ABI,
} from "./constants"

export type ReserveEnv = "production" | "staging" | "development"

export interface ReserveTransactionResult {
  hash: `0x${string}`
  receipt: TransactionReceipt
}

export interface ReserveEvent {
  type: "buy" | "sell"
  account: Address
  tokenIn: Address
  amountIn: bigint
  amountOut: bigint
  tx: `0x${string}`
  block: bigint
  timestamp?: number
}

export interface GetReserveEventsOptions {
  fromBlock?: bigint
  blocksAgo?: bigint
}

export class GoodReserveSDK {
  private publicClient: PublicClient
  private walletClient: WalletClient | null
  private contracts: Exclude<ReserveChainConfig, { mode: "unavailable" }>
  private mentoExchangeId: `0x${string}` | null = null

  constructor(
    publicClient: PublicClient,
    walletClient?: WalletClient,
    env: ReserveEnv = "production",
  ) {
    if (!publicClient) throw new Error("Public client is required")

    const chainId = publicClient.chain?.id
    if (!chainId) {
      throw new Error("Public client chain is required")
    }

    const reserveChain = getReserveChainFromId(chainId)
    if (!reserveChain) {
      throw new Error(
        `Unsupported chain id ${chainId}. Good reserve supports Celo (${CELO_CHAIN_ID}) and XDC (${XDC_CHAIN_ID})`,
      )
    }

    const contracts = RESERVE_CONTRACT_ADDRESSES[env][reserveChain]
    if (contracts.mode === "unavailable") {
      throw new Error(contracts.reason)
    }

    this.publicClient = publicClient
    this.walletClient = walletClient ?? null
    this.contracts = contracts
  }

  // Read methods.

  /**
   * Returns how much G$ you'd receive for a given input token amount.
   * @param tokenIn - Address of the token to spend (for example cUSD/USDC)
   * @param amountIn - Amount in token wei
   */
  async getBuyQuote(tokenIn: Address, amountIn: bigint): Promise<bigint> {
    if (amountIn <= 0n) throw new Error("amountIn must be greater than zero")

    if (this.contracts.mode === "exchange-helper") {
      return this.publicClient.readContract({
        address: this.contracts.buyGDFactory,
        abi: buyGDFactoryABI,
        functionName: "getBuyQuote",
        args: [tokenIn, amountIn],
      })
    }

    const exchangeId = await this.getMentoExchangeId()
    return this.publicClient.readContract({
      address: this.contracts.broker,
      abi: mentoBrokerABI,
      functionName: "getAmountOut",
      args: [
        this.contracts.exchangeProvider,
        exchangeId,
        tokenIn,
        this.contracts.goodDollar,
        amountIn,
      ],
    })
  }

  /**
   * Returns how much of the output token you'd receive for selling a given G$ amount.
   * @param gdAmount - G$ amount in wei
   * @param sellTo - Address of the token to receive
   */
  async getSellQuote(gdAmount: bigint, sellTo: Address): Promise<bigint> {
    if (gdAmount <= 0n) throw new Error("gdAmount must be greater than zero")

    if (this.contracts.mode === "exchange-helper") {
      return this.publicClient.readContract({
        address: this.contracts.buyGDFactory,
        abi: buyGDFactoryABI,
        functionName: "getSellQuote",
        args: [gdAmount, sellTo],
      })
    }

    const exchangeId = await this.getMentoExchangeId()
    return this.publicClient.readContract({
      address: this.contracts.broker,
      abi: mentoBrokerABI,
      functionName: "getAmountOut",
      args: [
        this.contracts.exchangeProvider,
        exchangeId,
        this.contracts.goodDollar,
        sellTo,
        gdAmount,
      ],
    })
  }

  /**
   * Returns the G$ balance of the given account.
   */
  async getGDBalance(account: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contracts.goodDollar,
      abi: erc20ABI,
      functionName: "balanceOf",
      args: [account],
    })
  }

  /**
   * Returns ERC20 decimals for a token.
   */
  async getTokenDecimals(token: Address): Promise<number> {
    const decimals = await this.publicClient.readContract({
      address: token,
      abi: erc20ABI,
      functionName: "decimals",
    })
    return Number(decimals)
  }

  /**
   * Returns the default reserve stable token address for the connected chain/env.
   */
  getStableTokenAddress(): Address {
    return this.contracts.stableToken
  }

  /**
   * Returns the GoodDollar token address for the connected chain/env.
   */
  getGoodDollarAddress(): Address {
    return this.contracts.goodDollar
  }

  /**
   * Fetches past buy/sell events for the given account.
   */
  async getTransactionHistory(
    account: Address,
    options: GetReserveEventsOptions = {},
  ): Promise<ReserveEvent[]> {
    const latestBlock = await this.publicClient.getBlockNumber()
    const blocksAgo = options.blocksAgo ?? 50000n
    const fromBlock =
      options.fromBlock ??
      (blocksAgo >= latestBlock ? 0n : latestBlock - blocksAgo)

    if (this.contracts.mode === "exchange-helper") {
      const [buyLogs, sellLogs] = await Promise.all([
        this.publicClient.getContractEvents({
          address: this.contracts.exchangeHelper,
          abi: exchangeHelperABI,
          eventName: "TokenPurchased",
          args: { caller: account },
          fromBlock,
          toBlock: latestBlock,
        }),
        this.publicClient.getContractEvents({
          address: this.contracts.exchangeHelper,
          abi: exchangeHelperABI,
          eventName: "TokenSold",
          args: { caller: account },
          fromBlock,
          toBlock: latestBlock,
        }),
      ])

      const buys: ReserveEvent[] = buyLogs.map((log) => ({
        type: "buy",
        account,
        tokenIn: log.args.inputToken as Address,
        amountIn: log.args.inputAmount as bigint,
        amountOut: log.args.actualReturn as bigint,
        tx: log.transactionHash,
        block: log.blockNumber,
      }))

      const sells: ReserveEvent[] = sellLogs.map((log) => ({
        type: "sell",
        account,
        tokenIn: this.contracts.goodDollar,
        amountIn: log.args.gdAmount as bigint,
        amountOut: log.args.actualReturn as bigint,
        tx: log.transactionHash,
        block: log.blockNumber,
      }))

      return [...buys, ...sells].sort((a, b) =>
        a.block < b.block ? -1 : a.block > b.block ? 1 : 0,
      )
    }

    const exchangeId = await this.getMentoExchangeId()
    const logs = await this.publicClient.getContractEvents({
      address: this.contracts.broker,
      abi: mentoBrokerABI,
      eventName: "Swap",
      args: { exchangeId, trader: account },
      fromBlock,
      toBlock: latestBlock,
    })

    const events: ReserveEvent[] = logs.map((log) => {
      const tokenIn = log.args.tokenIn as Address
      const tokenOut = log.args.tokenOut as Address
      const amountIn = log.args.amountIn as bigint
      const amountOut = log.args.amountOut as bigint
      const isBuy = this.sameAddress(tokenOut, this.contracts.goodDollar)

      return {
        type: isBuy ? "buy" : "sell",
        account,
        tokenIn,
        amountIn,
        amountOut,
        tx: log.transactionHash,
        block: log.blockNumber,
      }
    })

    return events.sort((a, b) =>
      a.block < b.block ? -1 : a.block > b.block ? 1 : 0,
    )
  }

  // Write methods.

  /**
   * Buys G$ by spending the given input token.
   * Approves spender if needed, then executes the swap.
   * @param tokenIn - Token to spend
   * @param amountIn - Amount in token wei
   * @param minReturn - Minimum G$ to receive (slippage guard)
   * @param onHash - Optional callback for the tx hash
   */
  async buy(
    tokenIn: Address,
    amountIn: bigint,
    minReturn: bigint,
    onHash?: (hash: `0x${string}`) => void,
  ): Promise<ReserveTransactionResult> {
    if (amountIn <= 0n) throw new Error("amountIn must be greater than zero")
    if (minReturn < 0n) throw new Error("minReturn cannot be negative")

    await this.ensureAllowance(
      tokenIn,
      this.getSwapSpender(),
      amountIn,
      onHash,
    )

    if (this.contracts.mode === "exchange-helper") {
      return this.submitAndWait(
        {
          address: this.contracts.exchangeHelper,
          abi: exchangeHelperABI,
          functionName: "buy",
          args: [tokenIn, amountIn, minReturn],
        },
        onHash,
      )
    }

    const exchangeId = await this.getMentoExchangeId()
    return this.submitAndWait(
      {
        address: this.contracts.broker,
        abi: mentoBrokerABI,
        functionName: "swapIn",
        args: [
          this.contracts.exchangeProvider,
          exchangeId,
          tokenIn,
          this.contracts.goodDollar,
          amountIn,
          minReturn,
        ],
      },
      onHash,
    )
  }

  /**
   * Sells G$ in exchange for the given output token.
   * Approves spender if needed, then executes the swap.
   * @param sellTo - Token to receive
   * @param gdAmount - G$ to sell in wei
   * @param minReturn - Minimum output tokens expected (slippage guard)
   * @param onHash - Optional callback for the tx hash
   */
  async sell(
    sellTo: Address,
    gdAmount: bigint,
    minReturn: bigint,
    onHash?: (hash: `0x${string}`) => void,
  ): Promise<ReserveTransactionResult> {
    if (gdAmount <= 0n) throw new Error("gdAmount must be greater than zero")
    if (minReturn < 0n) throw new Error("minReturn cannot be negative")

    await this.ensureAllowance(
      this.contracts.goodDollar,
      this.getSwapSpender(),
      gdAmount,
      onHash,
    )

    if (this.contracts.mode === "exchange-helper") {
      return this.submitAndWait(
        {
          address: this.contracts.exchangeHelper,
          abi: exchangeHelperABI,
          functionName: "sell",
          args: [sellTo, gdAmount, minReturn],
        },
        onHash,
      )
    }

    const exchangeId = await this.getMentoExchangeId()
    return this.submitAndWait(
      {
        address: this.contracts.broker,
        abi: mentoBrokerABI,
        functionName: "swapIn",
        args: [
          this.contracts.exchangeProvider,
          exchangeId,
          this.contracts.goodDollar,
          sellTo,
          gdAmount,
          minReturn,
        ],
      },
      onHash,
    )
  }

  // Internal helper methods.

  private getWalletClient(): WalletClient {
    if (!this.walletClient)
      throw new Error("A wallet client is required for write operations")
    return this.walletClient
  }

  private async getAccount(): Promise<Address> {
    const wc = this.getWalletClient()
    const [account] = await wc.getAddresses()
    if (!account) throw new Error("No account found in wallet client")
    return account
  }

  private getSwapSpender(): Address {
    if (this.contracts.mode === "exchange-helper") {
      return this.contracts.exchangeHelper
    }
    return this.contracts.broker
  }

  private async getMentoExchangeId(): Promise<`0x${string}`> {
    if (this.contracts.mode !== "mento-broker") {
      throw new Error("Mento exchange id requested on non-Mento config")
    }

    if (this.mentoExchangeId) {
      return this.mentoExchangeId
    }

    const exchangeIds = await this.publicClient.readContract({
      address: this.contracts.exchangeProvider,
      abi: mentoExchangeProviderABI,
      functionName: "getExchangeIds",
    })

    for (const exchangeId of exchangeIds) {
      const pool = await this.publicClient.readContract({
        address: this.contracts.exchangeProvider,
        abi: mentoExchangeProviderABI,
        functionName: "getPoolExchange",
        args: [exchangeId],
      })

      const reserveAsset = Array.isArray(pool)
        ? (pool[0] as Address | undefined)
        : (pool as { reserveAsset?: Address }).reserveAsset
      const tokenAddress = Array.isArray(pool)
        ? (pool[1] as Address | undefined)
        : (pool as { tokenAddress?: Address }).tokenAddress

      if (!reserveAsset || !tokenAddress) {
        continue
      }

      const matchesPool =
        this.sameAddress(reserveAsset, this.contracts.stableToken) &&
        this.sameAddress(tokenAddress, this.contracts.goodDollar)

      if (matchesPool) {
        this.mentoExchangeId = exchangeId
        return exchangeId
      }
    }

    throw new Error(
      `No matching Mento pool found for ${this.contracts.goodDollar} and ${this.contracts.stableToken}`,
    )
  }

  private sameAddress(a: Address, b: Address): boolean {
    return a.toLowerCase() === b.toLowerCase()
  }

  private async ensureAllowance(
    token: Address,
    spender: Address,
    amount: bigint,
    onHash?: (hash: `0x${string}`) => void,
  ) {
    const account = await this.getAccount()
    const allowance = await this.publicClient.readContract({
      address: token,
      abi: erc20ABI,
      functionName: "allowance",
      args: [account, spender],
    })

    if (allowance >= amount) return

    await this.submitAndWait(
      {
        address: token,
        abi: erc20ABI,
        functionName: "approve",
        args: [spender, amount],
      },
      onHash,
    )
  }

  private async submitAndWait(
    params: SimulateContractParameters,
    onHash?: (hash: `0x${string}`) => void,
  ): Promise<ReserveTransactionResult> {
    const wc = this.getWalletClient()
    const account = await this.getAccount()

    const { request } = await this.publicClient.simulateContract({
      account,
      ...params,
    })

    const hash = await wc.writeContract(request)
    onHash?.(hash)

    const receipt = await waitForTransactionReceipt(this.publicClient, { hash })
    return { hash, receipt }
  }
}

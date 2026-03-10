import {
  type Address,
  type PublicClient,
  type WalletClient,
  type TransactionReceipt,
  type SimulateContractParameters,
  maxUint256,
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
  tokenOut: Address
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

export type ReserveRouteInfo = {
  env: ReserveEnv
  chainId: number
  mode: "exchange-helper" | "mento-broker"
  stableToken: Address
  goodDollar: Address
  exchangeHelper?: Address
  buyGDFactory?: Address
  broker?: Address
  exchangeProvider?: Address
}

export interface ReserveStats {
  goodDollarTotalSupply: bigint
  stableTokenDecimals: number
  goodDollarDecimals: number
  poolReserveBalance: bigint | null
  poolTokenSupply: bigint | null
  reserveRatio: number | null
  exitContribution: number | null
}

export interface GoodReserveSDKOptions {
  /**
   * When true, approval transactions use the exact `amount` required instead of
   * `maxUint256`. Defaults to false (approve max) to reduce future approval tx
   * overhead at the cost of a slightly less conservative approval model.
   */
  exactApproval?: boolean
}

export class GoodReserveSDK {
  private publicClient: PublicClient
  private walletClient: WalletClient | null
  private contracts: Exclude<ReserveChainConfig, { mode: "unavailable" }>
  private mentoExchangeId: `0x${string}` | null = null
  private chainId: number
  private env: ReserveEnv
  private exactApproval: boolean

  constructor(
    publicClient: PublicClient,
    walletClient?: WalletClient,
    env: ReserveEnv = "production",
    options: GoodReserveSDKOptions = {},
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
    this.chainId = chainId
    this.env = env
    this.exactApproval = options.exactApproval ?? false
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
   * Returns active route info including chain/env and contract addresses in use.
   */
  getRouteInfo(): ReserveRouteInfo {
    if (this.contracts.mode === "exchange-helper") {
      return {
        env: this.env,
        chainId: this.chainId,
        mode: "exchange-helper",
        stableToken: this.contracts.stableToken,
        goodDollar: this.contracts.goodDollar,
        exchangeHelper: this.contracts.exchangeHelper,
        buyGDFactory: this.contracts.buyGDFactory,
      }
    }

    return {
      env: this.env,
      chainId: this.chainId,
      mode: "mento-broker",
      stableToken: this.contracts.stableToken,
      goodDollar: this.contracts.goodDollar,
      broker: this.contracts.broker,
      exchangeProvider: this.contracts.exchangeProvider,
    }
  }

  /**
   * Returns reserve-related stats useful for UI diagnostics.
   */
  async getReserveStats(): Promise<ReserveStats> {
    const [goodDollarTotalSupply, stableTokenDecimals, goodDollarDecimals] =
      await Promise.all([
        this.publicClient.readContract({
          address: this.contracts.goodDollar,
          abi: erc20ABI,
          functionName: "totalSupply",
        }),
        this.getTokenDecimals(this.contracts.stableToken),
        this.getTokenDecimals(this.contracts.goodDollar),
      ])

    if (this.contracts.mode === "exchange-helper") {
      return {
        goodDollarTotalSupply,
        stableTokenDecimals,
        goodDollarDecimals,
        poolReserveBalance: null,
        poolTokenSupply: null,
        reserveRatio: null,
        exitContribution: null,
      }
    }

    const exchangeId = await this.getMentoExchangeId()
    const pool = await this.publicClient.readContract({
      address: this.contracts.exchangeProvider,
      abi: mentoExchangeProviderABI,
      functionName: "getPoolExchange",
      args: [exchangeId],
    })

    const { tokenSupply, reserveBalance, reserveRatio, exitContribution } =
      this.extractPoolStats(pool)

    return {
      goodDollarTotalSupply,
      stableTokenDecimals,
      goodDollarDecimals,
      poolReserveBalance: reserveBalance,
      poolTokenSupply: tokenSupply,
      reserveRatio,
      exitContribution,
    }
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
        tokenOut: this.contracts.goodDollar,
        amountIn: log.args.inputAmount as bigint,
        amountOut: log.args.actualReturn as bigint,
        tx: log.transactionHash,
        block: log.blockNumber,
      }))

      const sells: ReserveEvent[] = sellLogs.map((log) => ({
        type: "sell",
        account,
        tokenIn: this.contracts.goodDollar,
        tokenOut: log.args.outputToken as Address,
        amountIn: log.args.gdAmount as bigint,
        amountOut: log.args.actualReturn as bigint,
        tx: log.transactionHash,
        block: log.blockNumber,
      }))

      const sortedEvents = [...buys, ...sells].sort((a, b) =>
        a.block < b.block ? -1 : a.block > b.block ? 1 : 0,
      )
      return this.attachTimestamps(sortedEvents)
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
        tokenOut,
        amountIn,
        amountOut,
        tx: log.transactionHash,
        block: log.blockNumber,
      }
    })

    const sortedEvents = events.sort((a, b) =>
      a.block < b.block ? -1 : a.block > b.block ? 1 : 0,
    )
    return this.attachTimestamps(sortedEvents)
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

    // Fan out pool reads in parallel instead of serially to reduce latency
    // when the exchange provider has multiple pools.
    // Captured into a local const so TypeScript narrowing is preserved inside
    // the arrow-function closure (mode was already guarded above).
    const exchangeProvider = this.contracts.exchangeProvider
    const pools = await Promise.all(
      exchangeIds.map((exchangeId) =>
        this.publicClient
          .readContract({
            address: exchangeProvider,
            abi: mentoExchangeProviderABI,
            functionName: "getPoolExchange",
            args: [exchangeId],
          })
          .then((pool) => ({ exchangeId, pool })),
      ),
    )

    for (const { exchangeId, pool } of pools) {
      const { reserveAsset, tokenAddress } = this.extractPoolAddresses(pool)

      if (!reserveAsset || !tokenAddress) continue

      if (
        this.sameAddress(reserveAsset, this.contracts.stableToken) &&
        this.sameAddress(tokenAddress, this.contracts.goodDollar)
      ) {
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

  /**
   * Normalises the return of `getPoolExchange` which viem may decode as a
   * named-field object or a positional tuple depending on ABI shape.
   * Fields (by position): reserveAsset, tokenAddress, tokenSupply,
   *                       reserveBalance, reserveRatio, exitContribution
   */
  private extractPoolAddresses(pool: unknown): {
    reserveAsset: Address | undefined
    tokenAddress: Address | undefined
  } {
    if (Array.isArray(pool)) {
      return {
        reserveAsset: pool[0] as Address | undefined,
        tokenAddress: pool[1] as Address | undefined,
      }
    }
    const p = pool as { reserveAsset?: Address; tokenAddress?: Address }
    return { reserveAsset: p.reserveAsset, tokenAddress: p.tokenAddress }
  }

  private extractPoolStats(pool: unknown): {
    tokenSupply: bigint | null
    reserveBalance: bigint | null
    reserveRatio: number | null
    exitContribution: number | null
  } {
    if (Array.isArray(pool)) {
      const toBigint = (v: unknown): bigint | null =>
        typeof v === "bigint" ? v : typeof v === "number" ? BigInt(v) : null
      const toNumber = (v: unknown): number | null =>
        typeof v === "number" ? v : typeof v === "bigint" ? Number(v) : null
      return {
        tokenSupply: toBigint(pool[2]),
        reserveBalance: toBigint(pool[3]),
        reserveRatio: toNumber(pool[4]),
        exitContribution: toNumber(pool[5]),
      }
    }
    const p = pool as {
      tokenSupply?: bigint | number
      reserveBalance?: bigint | number
      reserveRatio?: bigint | number
      exitContribution?: bigint | number
    }
    const toBigint = (v: bigint | number | undefined): bigint | null =>
      v === undefined ? null : typeof v === "bigint" ? v : BigInt(v)
    const toNumber = (v: bigint | number | undefined): number | null =>
      v === undefined ? null : typeof v === "bigint" ? Number(v) : v
    return {
      tokenSupply: toBigint(p.tokenSupply),
      reserveBalance: toBigint(p.reserveBalance),
      reserveRatio: toNumber(p.reserveRatio),
      exitContribution: toNumber(p.exitContribution),
    }
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

    // With exactApproval=false (default) we approve maxUint256 to avoid
    // repeated approval transactions on subsequent swaps. Set exactApproval=true
    // in the constructor options for a more conservative approval model.
    const approvalAmount = this.exactApproval ? amount : maxUint256
    await this.submitAndWait(
      {
        address: token,
        abi: erc20ABI,
        functionName: "approve",
        args: [spender, approvalAmount],
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

  private async attachTimestamps(events: ReserveEvent[]): Promise<ReserveEvent[]> {
    if (events.length === 0) return events

    const uniqueBlocks = [...new Set(events.map((event) => event.block.toString()))]
    const blockTimestamps = new Map<string, number>()

    const chunkSize = 10
    for (let i = 0; i < uniqueBlocks.length; i += chunkSize) {
      const chunk = uniqueBlocks.slice(i, i + chunkSize)
      await Promise.all(
        chunk.map(async (blockKey) => {
          const blockNumber = BigInt(blockKey)
          const block = await this.publicClient.getBlock({ blockNumber })
          const timestamp = Number(block.timestamp)

          if (!Number.isNaN(timestamp)) {
            blockTimestamps.set(blockKey, timestamp)
          }
        }),
      )
    }

    return events.map((event) => {
      const timestamp = blockTimestamps.get(event.block.toString())
      return timestamp === undefined ? event : { ...event, timestamp }
    })
  }
}

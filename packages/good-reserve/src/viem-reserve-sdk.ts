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
  exchangeHelperABI,
  buyGDFactoryABI,
  erc20ABI,
} from "./constants"

export type ReserveEnv = "production" | "staging" | "development"

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
  private contracts: (typeof RESERVE_CONTRACT_ADDRESSES)[ReserveEnv]

  constructor(
    publicClient: PublicClient,
    walletClient?: WalletClient,
    env: ReserveEnv = "production",
  ) {
    if (!publicClient) throw new Error("Public client is required")
    if (publicClient.chain?.id !== CELO_CHAIN_ID) {
      throw new Error("The GoodDollar reserve is only available on Celo")
    }
    this.publicClient = publicClient
    this.walletClient = walletClient ?? null
    this.contracts = RESERVE_CONTRACT_ADDRESSES[env]
  }

  // Read methods.

  /**
   * Returns how much G$ you'd receive for a given input token amount.
   * @param tokenIn - Address of the token to spend (e.g. cUSD)
   * @param amountIn - Amount in token wei
   */
  async getBuyQuote(tokenIn: Address, amountIn: bigint): Promise<bigint> {
    if (amountIn <= 0n) throw new Error("amountIn must be greater than zero")

    return this.publicClient.readContract({
      address: this.contracts.buyGDFactory,
      abi: buyGDFactoryABI,
      functionName: "getBuyQuote",
      args: [tokenIn, amountIn],
    })
  }

  /**
   * Returns how much of the output token you'd receive for selling a given G$ amount.
   * @param gdAmount - G$ amount in wei
   * @param sellTo - Address of the token to receive (e.g. cUSD)
   */
  async getSellQuote(gdAmount: bigint, sellTo: Address): Promise<bigint> {
    if (gdAmount <= 0n) throw new Error("gdAmount must be greater than zero")

    return this.publicClient.readContract({
      address: this.contracts.buyGDFactory,
      abi: buyGDFactoryABI,
      functionName: "getSellQuote",
      args: [gdAmount, sellTo],
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
   * Fetches past buy/sell events for the given account from ExchangeHelper.
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

  // Write methods.

  /**
   * Buys G$ by spending the given input token.
   * Approves ExchangeHelper if needed, then executes the swap.
   * @param tokenIn - Token to spend (e.g. cUSD address)
   * @param amountIn - Amount in token wei
   * @param minReturn - Minimum G$ to receive (slippage guard)
   * @param onHash - Optional callback for the tx hash
   */
  async buy(
    tokenIn: Address,
    amountIn: bigint,
    minReturn: bigint,
    onHash?: (hash: `0x${string}`) => void,
  ): Promise<TransactionReceipt> {
    if (amountIn <= 0n) throw new Error("amountIn must be greater than zero")
    if (minReturn < 0n) throw new Error("minReturn cannot be negative")

    await this.ensureAllowance(tokenIn, amountIn, onHash)

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

  /**
   * Sells G$ in exchange for the given output token.
   * Approves ExchangeHelper if needed, then executes the swap.
   * @param sellTo - Token to receive (e.g. cUSD address)
   * @param gdAmount - G$ to sell in wei
   * @param minReturn - Minimum output tokens expected (slippage guard)
   * @param onHash - Optional callback for the tx hash
   */
  async sell(
    sellTo: Address,
    gdAmount: bigint,
    minReturn: bigint,
    onHash?: (hash: `0x${string}`) => void,
  ): Promise<TransactionReceipt> {
    if (gdAmount <= 0n) throw new Error("gdAmount must be greater than zero")
    if (minReturn < 0n) throw new Error("minReturn cannot be negative")

    await this.ensureAllowance(this.contracts.goodDollar, gdAmount, onHash)

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

  private async ensureAllowance(
    token: Address,
    amount: bigint,
    onHash?: (hash: `0x${string}`) => void,
  ) {
    const account = await this.getAccount()
    const allowance = await this.publicClient.readContract({
      address: token,
      abi: erc20ABI,
      functionName: "allowance",
      args: [account, this.contracts.exchangeHelper],
    })

    if (allowance >= amount) return

    await this.submitAndWait(
      {
        address: token,
        abi: erc20ABI,
        functionName: "approve",
        args: [this.contracts.exchangeHelper, amount],
      },
      onHash,
    )
  }

  private async submitAndWait(
    params: SimulateContractParameters,
    onHash?: (hash: `0x${string}`) => void,
  ): Promise<TransactionReceipt> {
    const wc = this.getWalletClient()
    const account = await this.getAccount()

    const { request } = await this.publicClient.simulateContract({
      account,
      ...params,
    })

    const hash = await wc.writeContract(request)
    onHash?.(hash)

    return waitForTransactionReceipt(this.publicClient, { hash })
  }
}

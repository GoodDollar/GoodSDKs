import {
  PublicClient,
  WalletClient,
  parseAbi,
  type Address,
  type Hash,
  type TransactionReceipt,
  type SimulateContractParameters,
} from "viem"
import { normalizeAmount } from "./utils/decimals"
import {
  fetchFeeEstimates,
  getFeeEstimate,
} from "./utils/fees"
import {
  SUPPORTED_CHAINS,
  BRIDGE_CONTRACT_ADDRESSES,
  EVENT_QUERY_BATCH_SIZE,
  HISTORY_BLOCK_LOOKBACK,
  API_ENDPOINTS,
} from "./constants"
import type {
  BridgeProtocol,
  ChainId,
  CanBridgeResult,
  FeeEstimate,
  BridgeRequestEvent,
  ExecutedTransferEvent,
  EventOptions,
  TransactionStatus,
  GoodServerFeeResponse,
  LayerZeroScanResponse,
  AxelarscanResponse,
  BridgeConfig,
  BridgeQuote,
  BridgeQuoteResult,
  BridgeRequirement,
  BridgeStatus,
} from "./types"

import { MESSAGE_PASSING_BRIDGE_ABI } from "./abi"

export class BridgingSDK {
  public publicClient: PublicClient
  private walletClient: WalletClient | null = null
  private currentChainId: ChainId
  private fees: GoodServerFeeResponse | null = null
  private lastFeeFetchTime: number = 0
  private readonly FEE_CACHE_TTL = 60000 // 60 seconds

  constructor(
    publicClient: PublicClient,
    walletClient?: WalletClient,
    chainId?: ChainId,
  ) {
    if (!publicClient) throw new Error("Public client is required")

    this.publicClient = publicClient
    this.walletClient = walletClient || null
    this.currentChainId = chainId || publicClient.chain?.id || 0

    if (!SUPPORTED_CHAINS[this.currentChainId]) {
      throw new Error(`Unsupported chain ID: ${this.currentChainId}`)
    }
  }

  /**
   * Initializes the SDK by fetching and caching bridge fees
   */
  async initialize(): Promise<void> {
    this.fees = await fetchFeeEstimates()
    this.lastFeeFetchTime = Date.now()
  }

  setWalletClient(walletClient: WalletClient) {
    if (!walletClient.chain?.id || !SUPPORTED_CHAINS[walletClient.chain.id]) {
      throw new Error(`Unsupported chain ID: ${walletClient.chain?.id}`)
    }
    this.walletClient = walletClient
    // currentChainId is driven by publicClient — do not override it here
  }

  /**
   * Checks if an address can bridge a specified amount to a target chain
   */
  async canBridge(
    from: Address,
    amount: bigint,
    targetChainId: ChainId,
  ): Promise<CanBridgeResult> {
    if (!SUPPORTED_CHAINS[targetChainId]) {
      return {
        isWithinLimit: false,
        error: `Unsupported target chain: ${targetChainId}`,
      }
    }

    try {
      const contractAddress = BRIDGE_CONTRACT_ADDRESSES[this.currentChainId]
      if (!contractAddress) {
        return {
          isWithinLimit: false,
          error: `Bridge contract not deployed on chain ${this.currentChainId}`,
        }
      }

      // Normalize amount to 18 decimals for the contract check
      const normalizedAmount = normalizeAmount(amount, this.currentChainId)

      const [isWithinLimit, canBridgeError] =
        (await this.publicClient.readContract({
          address: contractAddress as Address,
          abi: MESSAGE_PASSING_BRIDGE_ABI,
          functionName: "canBridge",
          args: [from, normalizedAmount],
        })) as [boolean, string]

      if (!isWithinLimit && canBridgeError.includes("BRIDGE_LIMITS")) {
        // Fetch detailed limits to provide a better error message
        try {
          const limits = await this.publicClient.readContract({
            address: contractAddress as Address,
            abi: MESSAGE_PASSING_BRIDGE_ABI,
            functionName: "bridgeLimits"
          }) as [bigint, bigint, bigint, bigint, boolean];
          
          const minAmountObj = limits[3];
          if (normalizedAmount < minAmountObj) {
            return {
              isWithinLimit: false,
              error: `Amount is below the minimum required bridge limit. It must be at least ${minAmountObj.toString()} wei.`,
            }
          }
        } catch (e) {
          console.warn("Could not fetch specific bridge limits for error details", e)
        }
      }

      return {
        isWithinLimit,
        error: isWithinLimit ? undefined : canBridgeError,
      }
    } catch (error) {
      return {
        isWithinLimit: false,
        error: `Failed to check bridge limits: ${error instanceof Error ? error.message : "Unknown error"}`,
      }
    }
  }

  /**
   * Estimates the fee for bridging to a target chain using a specific protocol
   * Uses cached fees if available, otherwise fetches them
   */
  async estimateFee(
    targetChainId: ChainId,
    protocol: BridgeProtocol,
    fromChainId?: ChainId,
  ): Promise<FeeEstimate> {
    const sourceChain = fromChainId || this.currentChainId;
    
    // Protocol support validation
    if (protocol === "AXELAR" && (sourceChain === 50 || sourceChain === 122 || targetChainId === 50 || targetChainId === 122)) {
      throw new Error(`Axelar bridging is not supported for ${SUPPORTED_CHAINS[sourceChain]?.name} or ${SUPPORTED_CHAINS[targetChainId]?.name}`)
    }

    const now = Date.now()
    if (!this.fees || now - this.lastFeeFetchTime > this.FEE_CACHE_TTL) {
      try {
        await this.initialize()
      } catch (err) {
        if (!this.fees) throw err;
        console.warn("Using stale fee cache due to fetch error:", err);
      }
    }

    return await getFeeEstimate(sourceChain, targetChainId, protocol, this.fees!)
  }

  /**
   * Generic bridge method that automatically selects the best protocol
   */
  async bridgeTo(
    target: Address,
    targetChainId: ChainId,
    amount: bigint,
    protocol: BridgeProtocol,
  ): Promise<TransactionReceipt> {
    return this.bridgeInternal({
      targetChainId,
      protocol,
      fn: "bridgeTo",
      args: [target, targetChainId, amount, protocol === "AXELAR" ? 0 : 1],
    })
  }

  /**
   * Gets the G$ token balance for an address on the current chain
   */
  async getG$Balance(address: Address): Promise<bigint> {
    const tokenAddress = SUPPORTED_CHAINS[this.currentChainId]?.tokenAddress
    if (!tokenAddress) throw new Error("G$ token address not found")

    return (await this.publicClient.readContract({
      address: tokenAddress as Address,
      abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
      functionName: "balanceOf",
      args: [address],
    })) as bigint
  }

  /**
   * Gets the current allowance for the bridge contract
   */
  async getAllowance(owner: Address): Promise<bigint> {
    const tokenAddress = SUPPORTED_CHAINS[this.currentChainId]?.tokenAddress
    const bridgeAddress = BRIDGE_CONTRACT_ADDRESSES[this.currentChainId]
    
    if (!tokenAddress || !bridgeAddress) throw new Error("G$ token or bridge address not found")

    return (await this.publicClient.readContract({
      address: tokenAddress as Address,
      abi: parseAbi(["function allowance(address,address) view returns (uint256)"]),
      functionName: "allowance",
      args: [owner, bridgeAddress as Address],
    })) as bigint
  }

  /**
   * Approves the bridge contract to spend G$ tokens
   */
  async approve(amount: bigint): Promise<TransactionReceipt> {
    if (!this.walletClient) throw new Error("Wallet client not initialized")
    
    const tokenAddress = SUPPORTED_CHAINS[this.currentChainId]?.tokenAddress
    const bridgeAddress = BRIDGE_CONTRACT_ADDRESSES[this.currentChainId]
    
    if (!tokenAddress || !bridgeAddress) throw new Error("G$ token or bridge address not found")

    const account = await this.walletClient.getAddresses()
    if (!account[0]) throw new Error("No account found")

    const { request } = await this.publicClient.simulateContract({
      account: account[0],
      address: tokenAddress as Address,
      abi: parseAbi(["function approve(address,uint256) returns (bool)"]),
      functionName: "approve",
      args: [bridgeAddress as Address, amount],
    })

    const hash = await this.walletClient.writeContract(request)
    return await this.publicClient.waitForTransactionReceipt({ hash })
  }

  /**
   * Bridge using LayerZero with custom adapter parameters
   */
  async bridgeToWithLz(
    target: Address,
    targetChainId: ChainId,
    amount: bigint,
    adapterParams?: `0x${string}`,
  ): Promise<TransactionReceipt> {
    return this.bridgeInternal({
      targetChainId,
      protocol: "LAYERZERO",
      fn: "bridgeToWithLzAdapterParams",
      args: [target, targetChainId, amount, adapterParams || "0x"],
    })
  }

  /**
   * Bridge using Axelar with optional gas refund address
   */
  async bridgeToWithAxelar(
    target: Address,
    targetChainId: ChainId,
    amount: bigint,
  ): Promise<TransactionReceipt> {
    return this.bridgeInternal({
      targetChainId,
      protocol: "AXELAR",
      fn: "bridgeToWithAxelar",
      args: [target, targetChainId, amount],
    })
  }

  /**
   * Internal bridge method that handles common logic for all bridge operations
   */
  private async bridgeInternal<TArgs extends any[]>(opts: {
    targetChainId: ChainId
    protocol: BridgeProtocol
    fn: "bridgeTo" | "bridgeToWithLzAdapterParams" | "bridgeToWithAxelar"
    args: TArgs
  }): Promise<TransactionReceipt> {
    if (!this.walletClient) {
      throw new Error("Wallet client not initialized")
    }

    const feeEstimate = await this.estimateFee(opts.targetChainId, opts.protocol)

    const contractAddress = BRIDGE_CONTRACT_ADDRESSES[this.currentChainId]
    if (!contractAddress) {
      throw new Error(
        `Bridge contract not deployed on chain ${this.currentChainId}`,
      )
    }

    return await this.submitAndWait(
      {
        address: contractAddress as Address,
        abi: MESSAGE_PASSING_BRIDGE_ABI,
        functionName: opts.fn,
        args: opts.args,
        value: feeEstimate.fee,
      },
      feeEstimate.fee,
    )
  }

  /**
   * Returns base state needed for the bridge UI: balances, fees cache, allowance, and on-chain limits.
   * Call once on load and refresh periodically.
   */
  async getBridgeConfig(address: Address): Promise<BridgeConfig> {
    // Ensure fees are cached
    const now = Date.now()
    if (!this.fees || now - this.lastFeeFetchTime > this.FEE_CACHE_TTL) {
      try {
        await this.initialize()
      } catch (err) {
        if (!this.fees) throw err
        console.warn("Using stale fee cache:", err)
      }
    }

    const contractAddress = BRIDGE_CONTRACT_ADDRESSES[this.currentChainId]

    const [tokenBalance, nativeBalance, allowance, routeLimits] = await Promise.all([
      this.getG$Balance(address),
      this.publicClient.getBalance({ address }),
      contractAddress
        ? this.getAllowance(address)
        : Promise.resolve(0n),
      contractAddress
        ? (this.publicClient.readContract({
            address: contractAddress as Address,
            abi: MESSAGE_PASSING_BRIDGE_ABI,
            functionName: "bridgeLimits",
          }) as Promise<[bigint, bigint, bigint, bigint, boolean]>)
            .then(([dailyLimit, txLimit, accountDailyLimit, minAmount, onlyWhitelisted]) => ({
              dailyLimit,
              txLimit,
              accountDailyLimit,
              minAmount,
              onlyWhitelisted,
            }))
            .catch(() => null)
        : Promise.resolve(null),
    ])

    return {
      supportedChains: SUPPORTED_CHAINS,
      currentChainId: this.currentChainId,
      tokenBalance,
      nativeBalance,
      allowance,
      fees: this.fees,
      routeLimits,
    }
  }

  /**
   * Evaluates whether a bridge operation can proceed and returns a validated quote.
   * Checks token balance, native balance for fee, allowance, bridge limits, and route availability.
   * Pass currentAllowance from a recent getBridgeConfig call (or 0n to force a re-check).
   */
  async getQuote(
    amount: bigint,
    fromChain: ChainId,
    toChain: ChainId,
    recipient: Address,
    protocol: BridgeProtocol,
    currentAllowance: bigint,
  ): Promise<BridgeQuoteResult> {
    const requirements: BridgeRequirement[] = []

    // Check route availability and get fee estimate first — if this fails, nothing else matters
    let feeEstimate: FeeEstimate
    try {
      feeEstimate = await this.estimateFee(toChain, protocol, fromChain)
    } catch (err) {
      requirements.push({
        type: "route_unavailable",
        message: err instanceof Error ? err.message : "Route not available for the selected chains and protocol",
      })
      return { quote: null, needsApproval: false, canBridge: false, requirements }
    }

    // Check wallet is on the correct source chain
    if (fromChain !== this.currentChainId) {
      requirements.push({
        type: "wrong_chain",
        message: `Wallet is on ${SUPPORTED_CHAINS[this.currentChainId]?.name ?? this.currentChainId} — switch to ${SUPPORTED_CHAINS[fromChain]?.name ?? fromChain} to bridge from it`,
      })
    }

    // Fetch token and native balances in parallel
    const [tokenBalance, nativeBalance] = await Promise.all([
      this.getG$Balance(recipient),
      this.publicClient.getBalance({ address: recipient }),
    ])

    if (tokenBalance < amount) {
      requirements.push({
        type: "insufficient_token_balance",
        message: `Insufficient G$ balance. Required: ${amount.toString()}, available: ${tokenBalance.toString()}`,
      })
    }

    if (nativeBalance < feeEstimate.fee) {
      const chainName = SUPPORTED_CHAINS[this.currentChainId]?.name ?? "native"
      requirements.push({
        type: "insufficient_native_balance",
        message: `Insufficient ${chainName} to cover the bridge fee. Required: ${feeEstimate.feeInNative}`,
      })
    }

    // Approval check (non-blocking — doBridge handles the approval step)
    const needsApproval = currentAllowance < amount
    if (needsApproval) {
      requirements.push({
        type: "insufficient_allowance",
        message: `Token approval needed before bridging`,
      })
    }

    // On-chain bridge limits check
    try {
      const canBridgeResult = await this.canBridge(recipient, amount, toChain)
      if (!canBridgeResult.isWithinLimit) {
        let msg = canBridgeResult.error || "Amount is outside bridge limits"
        if (msg.includes("BRIDGE_LIMITS")) {
          msg = "Amount is outside the allowed bridge limits (check minimum amount or daily limit)"
        }
        requirements.push({
          type: "exceeds_limit",
          message: msg,
        })
      }
    } catch {
      // canBridge failure is non-fatal — proceed with warning
    }

    // Blocking requirements are everything except the allowance (which doBridge resolves)
    const blockingReqs = requirements.filter((r) => r.type !== "insufficient_allowance")
    if (blockingReqs.length > 0) {
      return { quote: null, needsApproval, canBridge: false, requirements }
    }

    const quote: BridgeQuote = {
      fee: feeEstimate.fee,
      feeInNative: feeEstimate.feeInNative,
      protocol,
      target: recipient,
      targetChainId: toChain,
      amount,
    }

    return { quote, needsApproval, canBridge: !needsApproval, requirements }
  }

  /**
   * Executes a bridge operation from a validated quote.
   * Handles ERC-20 approval automatically if needed, then submits the bridge transaction.
   * Use the optional onStatus callback to update UI during each step.
   */
  async doBridge(
    quote: BridgeQuote,
    onStatus?: (status: BridgeStatus) => void,
  ): Promise<TransactionReceipt> {
    if (!this.walletClient) throw new Error("Wallet client not initialized")

    const accounts = await this.walletClient.getAddresses()
    const account = accounts[0]
    if (!account) throw new Error("No account found in wallet client")

    let approveTxHash: Hash | undefined

    // Step 1: Approve if the current allowance is still insufficient
    const currentAllowance = await this.getAllowance(account)
    if (currentAllowance < quote.amount) {
      onStatus?.({ step: "approving" })
      try {
        const approveReceipt = await this.approve(quote.amount)
        approveTxHash = approveReceipt.transactionHash
      } catch (err) {
        const error = err instanceof Error ? err.message : "Approval failed"
        onStatus?.({ step: "failed", approveTxHash, error })
        throw err
      }
    }

    // Step 2: Submit the bridge transaction
    onStatus?.({ step: "bridging", approveTxHash })
    try {
      const fn =
        quote.protocol === "LAYERZERO" && quote.adapterParams
          ? ("bridgeToWithLzAdapterParams" as const)
          : ("bridgeTo" as const)

      const args =
        fn === "bridgeToWithLzAdapterParams"
          ? [quote.target, quote.targetChainId, quote.amount, quote.adapterParams!]
          : [quote.target, quote.targetChainId, quote.amount, quote.protocol === "AXELAR" ? 0 : 1]

      const receipt = await this.bridgeInternal({
        targetChainId: quote.targetChainId,
        protocol: quote.protocol,
        fn,
        args,
      })

      onStatus?.({
        step: "completed",
        approveTxHash,
        bridgeTxHash: receipt.transactionHash,
        receipt,
      })
      return receipt
    } catch (err) {
      const error = err instanceof Error ? err.message : "Bridge failed"
      onStatus?.({ step: "failed", approveTxHash, error })
      throw err
    }
  }

  /**
   * Fetches the combined, sorted bridge history for an address on the current chain
   */
  async getHistory(address: Address, options?: EventOptions): Promise<(BridgeRequestEvent | ExecutedTransferEvent)[]> {
    return BridgingSDK._fetchChainHistory(address, this.publicClient, this.currentChainId, options)
  }

  /**
   * Fetches combined bridge history for a single chain using the provided client.
   * Results are sorted by block number (descending) within the chain.
   */
  private static async _fetchChainHistory(
    address: Address,
    publicClient: PublicClient,
    chainId: ChainId,
    options?: EventOptions,
  ): Promise<(BridgeRequestEvent | ExecutedTransferEvent)[]> {
    const contractAddress = BRIDGE_CONTRACT_ADDRESSES[chainId]
    if (!contractAddress) {
      throw new Error(`Bridge contract not deployed on chain ${chainId}`)
    }

    const currentBlock = await publicClient.getBlockNumber()
    const lookback = HISTORY_BLOCK_LOOKBACK[chainId] ?? 50000n
    const fromBlock = options?.fromBlock || (currentBlock > lookback ? currentBlock - lookback : 0n)
    const toBlock = options?.toBlock || "latest"
    const limit = options?.limit || EVENT_QUERY_BATCH_SIZE

    const [requestLogs, executedLogs] = await Promise.all([
      publicClient.getContractEvents({
        address: contractAddress as Address,
        abi: MESSAGE_PASSING_BRIDGE_ABI,
        eventName: "BridgeRequest",
        args: { from: address },
        fromBlock,
        toBlock,
      }),
      publicClient.getContractEvents({
        address: contractAddress as Address,
        abi: MESSAGE_PASSING_BRIDGE_ABI,
        eventName: "ExecutedTransfer",
        args: { to: address },
        fromBlock,
        toBlock,
      }),
    ])

    const requests: BridgeRequestEvent[] = (requestLogs as any[]).slice(0, limit).map((log) => ({
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
      address: log.address,
      chainId,
      args: {
        from: log.args.from as Address,
        to: log.args.to as Address,
        amount: log.args.normalizedAmount as bigint,
        targetChainId: Number(log.args.targetChainId) as ChainId,
        timestamp: log.args.timestamp as bigint,
        bridge: log.args.bridge === 0 ? "AXELAR" : "LAYERZERO",
        id: log.args.id as bigint,
      },
    }))

    const executed: ExecutedTransferEvent[] = (executedLogs as any[]).slice(0, limit).map((log) => ({
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
      address: log.address,
      chainId,
      args: {
        from: log.args.from as Address,
        to: log.args.to as Address,
        amount: log.args.normalizedAmount as bigint,
        fee: log.args.fee as bigint,
        sourceChainId: Number(log.args.sourceChainId) as ChainId,
        bridge: log.args.bridge === 0 ? "AXELAR" : "LAYERZERO",
        id: log.args.id as bigint,
      },
    }))

    return [...requests, ...executed].sort((a, b) => {
      if (a.blockNumber < b.blockNumber) return 1
      if (a.blockNumber > b.blockNumber) return -1
      return 0
    })
  }

  /**
   * Fetches bridge history for an address across multiple chains.
   * Each chain's results are sorted by block number internally.
   * No cross-chain sorting is applied since block numbers are chain-specific.
   */
  static async getAllHistory(
    address: Address,
    clients: Record<number, PublicClient>,
    options?: EventOptions
  ): Promise<(BridgeRequestEvent | ExecutedTransferEvent)[]> {
    const historyPromises = Object.entries(clients).map(async ([chainIdStr, client]) => {
      try {
        const chainId = Number(chainIdStr) as ChainId
        return await BridgingSDK._fetchChainHistory(address, client, chainId, options)
      } catch (err) {
        console.warn(`Failed to fetch history for chain ${chainIdStr}: ${err instanceof Error ? err.message : String(err)}`)
        return []
      }
    })

    const allHistoryByChain = await Promise.all(historyPromises)
    const allEvents = allHistoryByChain.flat()

    // Deduplicate: BridgeRequest and ExecutedTransfer share the same `id` when
    // the bridge completes. Keep only the ExecutedTransfer in that case, since
    // it represents the final state.
    const executedIds = new Set(
      allEvents
        .filter((e): e is ExecutedTransferEvent => !("targetChainId" in e.args))
        .map((e) => e.args.id)
    )

    return allEvents.filter((e) => {
      if ("targetChainId" in e.args) {
        // BridgeRequest — drop if a matching ExecutedTransfer exists
        return !executedIds.has(e.args.id)
      }
      return true
    })
  }

  /**
   * Fetches BridgeRequest events for an address with block optimization
   */
  async getBridgeRequests(
    address: Address,
    options?: EventOptions,
  ): Promise<BridgeRequestEvent[]> {
    const contractAddress = BRIDGE_CONTRACT_ADDRESSES[this.currentChainId]
    if (!contractAddress) {
      throw new Error(`Bridge contract not deployed on chain ${this.currentChainId}`)
    }

    const currentBlock = await this.publicClient.getBlockNumber()
    const lookback = HISTORY_BLOCK_LOOKBACK[this.currentChainId] ?? 50000n
    const fromBlock = options?.fromBlock || (currentBlock > lookback ? currentBlock - lookback : 0n)
    const toBlock = options?.toBlock || "latest"
    const limit = options?.limit || EVENT_QUERY_BATCH_SIZE

    try {
      const logs = await this.publicClient.getContractEvents({
        address: contractAddress as Address,
        abi: MESSAGE_PASSING_BRIDGE_ABI,
        eventName: "BridgeRequest",
        args: { from: address },
        fromBlock,
        toBlock,
      })

      return (logs as any[]).slice(0, limit).map((log) => ({
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        address: log.address,
        chainId: this.currentChainId,
        args: {
          from: log.args.from as Address,
          to: log.args.to as Address,
          amount: log.args.normalizedAmount as bigint,
          targetChainId: Number(log.args.targetChainId) as ChainId,
          timestamp: log.args.timestamp as bigint,
          bridge: log.args.bridge === 0 ? "AXELAR" : "LAYERZERO",
          id: log.args.id as bigint,
        },
      }))
    } catch (error) {
      throw new Error(`Failed to fetch bridge requests: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  /**
   * Fetches ExecutedTransfer events for an address with block optimization
   */
  async getExecutedTransfers(
    address: Address,
    options?: EventOptions,
  ): Promise<ExecutedTransferEvent[]> {
    const contractAddress = BRIDGE_CONTRACT_ADDRESSES[this.currentChainId]
    if (!contractAddress) {
      throw new Error(`Bridge contract not deployed on chain ${this.currentChainId}`)
    }

    const currentBlock = await this.publicClient.getBlockNumber()
    const lookback = HISTORY_BLOCK_LOOKBACK[this.currentChainId] ?? 50000n
    const fromBlock = options?.fromBlock || (currentBlock > lookback ? currentBlock - lookback : 0n)
    const toBlock = options?.toBlock || "latest"
    const limit = options?.limit || EVENT_QUERY_BATCH_SIZE

    try {
      const logs = await this.publicClient.getContractEvents({
        address: contractAddress as Address,
        abi: MESSAGE_PASSING_BRIDGE_ABI,
        eventName: "ExecutedTransfer",
        args: { to: address },
        fromBlock,
        toBlock,
      })

      return (logs as any[]).slice(0, limit).map((log) => ({
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        address: log.address,
        chainId: this.currentChainId,
        args: {
          from: log.args.from as Address,
          to: log.args.to as Address,
          amount: log.args.normalizedAmount as bigint,
          fee: log.args.fee as bigint,
          sourceChainId: Number(log.args.sourceChainId) as ChainId,
          bridge: log.args.bridge === 0 ? "AXELAR" : "LAYERZERO",
          id: log.args.id as bigint,
        },
      }))
    } catch (error) {
      throw new Error(`Failed to fetch executed transfers: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  /**
   * Gets the status of a bridge transaction from external APIs
   */
  async getTransactionStatus(
    txHash: Hash,
    protocol: BridgeProtocol,
  ): Promise<TransactionStatus> {
    if (protocol === "LAYERZERO") {
      return this.getLayerZeroStatus(txHash)
    } else {
      return this.getAxelarStatus(txHash)
    }
  }

  private async getLayerZeroStatus(txHash: Hash): Promise<TransactionStatus> {
    const response = await fetch(`${API_ENDPOINTS.LAYERZERO_SCAN}/messages/tx/${txHash}`)
    if (!response.ok) {
      throw new Error(`LayerZero API error: ${response.statusText}`)
    }
    const data: LayerZeroScanResponse = await response.json()
    if (!data.data || data.data.length === 0) return { status: "pending" }
    
    const message = data.data[0]
    return {
      status: message.status.name === "DELIVERED" ? "completed" : message.status.name === "FAILED" ? "failed" : "pending",
      srcTxHash: message.source.tx.txHash,
      dstTxHash: message.destination?.tx?.txHash,
      timestamp: new Date(message.created).getTime(),
    }
  }

  private async getAxelarStatus(txHash: Hash): Promise<TransactionStatus> {
    const response = await fetch(`${API_ENDPOINTS.AXELARSCAN}/gmp?txHash=${txHash}`)
    if (!response.ok) {
      throw new Error(`Axelar API error: ${response.statusText}`)
    }
    const data: AxelarscanResponse = await response.json()
    if (!data.data || data.data.length === 0) return { status: "pending" }
    const transaction = data.data[0]
    return {
      status: transaction.status === "executed" ? "completed" : transaction.status === "failed" ? "failed" : "pending",
      srcTxHash: transaction.sourceTxHash,
      dstTxHash: transaction.destinationTxHash,
      timestamp: new Date(transaction.updatedAt).getTime(),
    }
  }

  /**
   * Generates an explorer link for a bridge transaction
   */
  explorerLink(txHash: Hash, protocol: BridgeProtocol): string {
    return protocol === "LAYERZERO" 
      ? `https://layerzeroscan.com/tx/${txHash}`
      : `https://axelarscan.io/gmp/${txHash}`
  }

  /**
   * Formats a chain name for display
   */
  static formatChainName(chainId: ChainId): string {
    switch (chainId) {
      case 42220: return "Celo"
      case 122: return "Fuse"
      case 1: return "Ethereum"
      case 50: return "XDC"
      default: return `Chain ${chainId}`
    }
  }

  /**
   * Formats a protocol name for display
   */
  static formatProtocolName(protocol: BridgeProtocol): string {
    return protocol === "LAYERZERO" ? "LayerZero" : "Axelar"
  }

  /**
   * Gets a human-readable status label
   */
  static getStatusLabel(status: TransactionStatus): string {
    switch (status.status) {
      case "pending": return "Pending"
      case "completed": return "Completed"
      case "failed": return "Failed"
      default: return "Unknown"
    }
  }

  /**
   * Gets the current chain ID
   */
  getCurrentChainId(): ChainId {
    return this.currentChainId
  }

  /**
   * Gets the supported chains
   */
  getSupportedChains(): Record<number, (typeof SUPPORTED_CHAINS)[0]> {
    return SUPPORTED_CHAINS
  }

  /**
   * Helper method to submit and wait for transaction receipt
   */
  private async submitAndWait(
    params: SimulateContractParameters,
    fee: bigint,
  ): Promise<TransactionReceipt> {
    if (!this.walletClient) {
      throw new Error("Wallet client not initialized")
    }

    const account = await this.walletClient.getAddresses()
    if (!account[0]) {
      throw new Error("No account found in wallet client")
    }

    // Simulate the transaction
    const { request } = await this.publicClient.simulateContract({
      account: account[0],
      ...params,
      value: params.value || fee,
    })

    // Submit the transaction
    const hash = await this.walletClient.writeContract(request)

    // Wait for the transaction receipt
    return await this.publicClient.waitForTransactionReceipt({ hash })
  }
}

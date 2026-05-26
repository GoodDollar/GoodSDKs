import {
  PublicClient,
  WalletClient,
  parseAbi,
  formatUnits,
  parseUnits,
  type Address,
  type Hash,
  type TransactionReceipt,
} from "viem"
import {
  SUPPORTED_CHAINS,
  BRIDGE_CONTRACT_ADDRESSES,
  EVENT_QUERY_BATCH_SIZE,
  HISTORY_BLOCK_LOOKBACK,
  API_ENDPOINTS,
  FEE_MULTIPLIER,
} from "./constants"
import type {
  BridgeProtocol,
  ChainId,
  BridgeChain,
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
    this.currentChainId = chainId || (publicClient.chain?.id as ChainId) || 0

    if (!SUPPORTED_CHAINS[this.currentChainId]) {
      throw new Error(`Unsupported chain ID: ${this.currentChainId}`)
    }
  }

  /**
   * Initializes the SDK by fetching and caching bridge fees
   */
  async initialize(): Promise<void> {
    try {
      const response = await fetch(API_ENDPOINTS.GOODSERVER_FEES)
      if (!response.ok) {
        throw new Error(`Failed to fetch fee estimates: ${response.statusText}`)
      }
      this.fees = await response.json()
      this.lastFeeFetchTime = Date.now()
    } catch (error) {
      throw new Error(
        `SDK initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  setWalletClient(walletClient: WalletClient) {
    if (!walletClient.chain?.id || !SUPPORTED_CHAINS[walletClient.chain.id]) {
      throw new Error(`Unsupported chain ID: ${walletClient.chain?.id}`)
    }
    this.walletClient = walletClient
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

      // Normalize amount to 18 decimals for the contract check if necessary
      const fromDecimals = SUPPORTED_CHAINS[this.currentChainId]?.decimals || 18
      let normalizedAmount = amount
      if (fromDecimals !== 18) {
        normalizedAmount = parseUnits(formatUnits(amount, fromDecimals), 18)
      }

      const [isWithinLimit, canBridgeError] = (await this.publicClient.readContract({
        address: contractAddress as Address,
        abi: MESSAGE_PASSING_BRIDGE_ABI,
        functionName: "canBridge",
        args: [from, normalizedAmount],
      })) as [boolean, string]

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
   */
  async estimateFee(
    targetChainId: ChainId,
    protocol: BridgeProtocol,
    fromChainId?: ChainId,
  ): Promise<FeeEstimate> {
    const sourceChain = fromChainId || this.currentChainId

    // Protocol support validation
    if (
      protocol === "AXELAR" &&
      (sourceChain === 50 || sourceChain === 122 || targetChainId === 50 || targetChainId === 122)
    ) {
      throw new Error(
        `Axelar bridging is not supported for ${SUPPORTED_CHAINS[sourceChain]?.name} or ${SUPPORTED_CHAINS[targetChainId]?.name}`
      )
    }

    const now = Date.now()
    if (!this.fees || now - this.lastFeeFetchTime > this.FEE_CACHE_TTL) {
      try {
        await this.initialize()
      } catch (err) {
        if (!this.fees) throw err
        console.warn("Using stale fee cache due to fetch error:", err)
      }
    }

    const protocolData = this.fees![protocol]
    if (!protocolData) {
      throw new Error(`No fee data available for protocol: ${protocol}`)
    }

    const fromChainName = this.getChainNameForApi(sourceChain)
    const toChainName = this.getChainNameForApi(targetChainId)

    const protocolPrefix = protocol === "AXELAR" ? "AXL" : "LZ"
    const routeKey = `${protocolPrefix}_${fromChainName}_TO_${toChainName}`
    const feeString = protocolData[routeKey]

    if (!feeString) {
      throw new Error(`No fee data available for route: ${fromChainName} to ${toChainName}`)
    }

    const [amountStr] = feeString.split(" ")
    const nativeDecimals = SUPPORTED_CHAINS[sourceChain]?.nativeCurrency.decimals || 18
    const fee = parseUnits(amountStr, nativeDecimals)

    // Add safety buffer
    const feeWithBuffer = (fee * BigInt(Math.floor(FEE_MULTIPLIER * 100))) / 100n

    return {
      fee: feeWithBuffer,
      feeInNative: feeString,
      protocol,
    }
  }

  /**
   * Bridge G$ tokens to a target chain
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
   * Bridge using LayerZero with custom adapter parameters
   */
  async bridgeToWithLz(
    target: Address,
    targetChainId: ChainId,
    amount: bigint,
    adapterParams: `0x${string}` = "0x",
  ): Promise<TransactionReceipt> {
    return this.bridgeInternal({
      targetChainId,
      protocol: "LAYERZERO",
      fn: "bridgeToWithLzAdapterParams",
      args: [target, targetChainId, amount, adapterParams],
    })
  }

  /**
   * Bridge using Axelar
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
    if (!this.walletClient) throw new Error("Wallet client not initialized")

    const feeEstimate = await this.estimateFee(opts.targetChainId, opts.protocol)
    const contractAddress = BRIDGE_CONTRACT_ADDRESSES[this.currentChainId]

    if (!contractAddress) {
      throw new Error(`Bridge contract not deployed on chain ${this.currentChainId}`)
    }

    const accounts = await this.walletClient.getAddresses()
    const account = accounts[0]
    if (!account) throw new Error("No account found")

    const { request } = await this.publicClient.simulateContract({
      account: account as Address,
      address: contractAddress as Address,
      abi: MESSAGE_PASSING_BRIDGE_ABI,
      functionName: opts.fn,
      args: opts.args as any,
      value: feeEstimate.fee,
    })

    const hash = await this.walletClient.writeContract(request)
    return await this.publicClient.waitForTransactionReceipt({ hash })
  }

  /**
   * Gets the G$ token balance for an address on a specific chain
   */
  async getG$Balance(address: Address, client: PublicClient = this.publicClient): Promise<bigint> {
    const chainId = (client.chain?.id as ChainId) || this.currentChainId
    const tokenAddress = SUPPORTED_CHAINS[chainId]?.tokenAddress
    if (!tokenAddress) throw new Error("G$ token address not found")

    return (await client.readContract({
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

    const accounts = await this.walletClient.getAddresses()
    const account = accounts[0]
    if (!account) throw new Error("No account found")

    const { request } = await this.publicClient.simulateContract({
      account,
      address: tokenAddress as Address,
      abi: parseAbi(["function approve(address,uint256) returns (bool)"]),
      functionName: "approve",
      args: [bridgeAddress as Address, amount],
    })

    const hash = await this.walletClient.writeContract(request)
    return await this.publicClient.waitForTransactionReceipt({ hash })
  }

  /**
   * Evaluates whether a bridge operation can proceed and returns a validated quote.
   * Performs dual-chain balance checks (source and target).
   */
  async getQuote(params: {
    sender: Address
    recipient?: Address
    amount: bigint
    fromChain: ChainId
    toChain: ChainId
    protocol: BridgeProtocol
    targetClient?: PublicClient
  }): Promise<BridgeQuoteResult> {
    const { sender, amount, fromChain, toChain, protocol, targetClient } = params
    const recipient = params.recipient || sender
    const requirements: BridgeRequirement[] = []

    // 1. Route and Fee Check
    let feeEstimate: FeeEstimate
    try {
      feeEstimate = await this.estimateFee(toChain, protocol, fromChain)
    } catch (err) {
      requirements.push({
        type: "route_unavailable",
        message: err instanceof Error ? err.message : "Route not available",
      })
      return { quote: null, needsApproval: false, canBridge: false, requirements }
    }

    // 2. Chain Match Check
    if (fromChain !== this.currentChainId) {
      requirements.push({
        type: "wrong_chain",
        message: `Switch network to ${SUPPORTED_CHAINS[fromChain]?.name || fromChain}`,
      })
    }

    // 3. Source Chain Balance Check (G$ + Native Fee)
    const [tokenBalance, nativeBalance, allowance] = await Promise.all([
      this.getG$Balance(sender),
      this.publicClient.getBalance({ address: sender }),
      this.getAllowance(sender).catch(() => 0n),
    ])

    if (tokenBalance < amount) {
      requirements.push({
        type: "insufficient_token_balance",
        message: `Insufficient G$ balance on source chain`,
      })
    }

    if (nativeBalance < feeEstimate.fee) {
      requirements.push({
        type: "insufficient_native_balance",
        message: `Insufficient native balance for bridge fee`,
      })
    }

    // 4. Target Chain Balance Check (Optional UX helper)
    let targetBalance: bigint | undefined
    if (targetClient) {
      try {
        targetBalance = await this.getG$Balance(recipient, targetClient)
      } catch (err) {
        console.warn("Failed to fetch target chain balance", err)
      }
    }

    // 5. Bridge Limits Check
    const canBridgeResult = await this.canBridge(sender, amount, toChain)
    if (!canBridgeResult.isWithinLimit) {
      requirements.push({
        type: "exceeds_limit",
        message: canBridgeResult.error || "Bridge limits exceeded",
      })
    }

    const needsApproval = allowance < amount
    const canBridge = requirements.length === 0

    const quote: BridgeQuote = {
      fee: feeEstimate.fee,
      feeInNative: feeEstimate.feeInNative,
      protocol,
      target: recipient,
      targetChainId: toChain,
      amount,
    }

    return { quote, needsApproval, canBridge, requirements, targetBalance }
  }

  /**
   * Executes bridge with automatic approval
   */
  async doBridge(
    quote: BridgeQuote,
    onStatus?: (status: BridgeStatus) => void,
  ): Promise<TransactionReceipt> {
    const accounts = await this.walletClient?.getAddresses()
    const account = accounts?.[0]
    if (!account) throw new Error("Wallet not connected")

    let approveTxHash: Hash | undefined

    const allowance = await this.getAllowance(account)
    if (allowance < quote.amount) {
      onStatus?.({ step: "approving" })
      const receipt = await this.approve(quote.amount)
      approveTxHash = receipt.transactionHash
    }

    onStatus?.({ step: "bridging", approveTxHash })
    try {
      const receipt = await this.bridgeTo(
        quote.target,
        quote.targetChainId,
        quote.amount,
        quote.protocol
      )
      onStatus?.({
        step: "completed",
        approveTxHash,
        bridgeTxHash: receipt.transactionHash,
        receipt,
      })
      return receipt
    } catch (error) {
      onStatus?.({
        step: "failed",
        approveTxHash,
        error: error instanceof Error ? error.message : "Bridge failed",
      })
      throw error
    }
  }

  /**
   * Combined history helper with cross-chain deduplication logic
   */
  async getCombinedHistory(
    address: Address,
    clients: Record<number, PublicClient>,
    options?: EventOptions
  ): Promise<(BridgeRequestEvent | ExecutedTransferEvent)[]> {
    const results = await Promise.all(
      Object.entries(clients).map(async ([chainId, client]) => {
        try {
          return await this.getChainHistory(address, client, Number(chainId), options)
        } catch {
          return []
        }
      })
    )

    const allEvents = results.flat().sort((a, b) => b.timestamp - a.timestamp)

    return allEvents
  }

  private async getChainHistory(
    address: Address,
    client: PublicClient,
    chainId: number,
    options?: EventOptions
  ): Promise<(BridgeRequestEvent | ExecutedTransferEvent)[]> {
    const contractAddress = BRIDGE_CONTRACT_ADDRESSES[chainId]
    if (!contractAddress) return []

    const currentBlock = await client.getBlockNumber()
    const lookback = HISTORY_BLOCK_LOOKBACK[chainId] || 10000n
    const fromBlock = options?.fromBlock || (currentBlock > lookback ? currentBlock - lookback : 0n)

    const [requests, executed] = await Promise.all([
      client.getContractEvents({
        address: contractAddress as Address,
        abi: MESSAGE_PASSING_BRIDGE_ABI,
        eventName: "BridgeRequest",
        args: { from: address },
        fromBlock,
      }),
      client.getContractEvents({
        address: contractAddress as Address,
        abi: MESSAGE_PASSING_BRIDGE_ABI,
        eventName: "ExecutedTransfer",
        args: { to: address },
        fromBlock,
      }),
    ])

    const formattedRequests = requests.map((log: any) => ({
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
      timestamp: Number(log.args.timestamp),
      address: log.address,
      chainId,
      args: {
        from: log.args.from,
        to: log.args.to,
        amount: log.args.normalizedAmount,
        targetChainId: Number(log.args.targetChainId),
        timestamp: log.args.timestamp,
        bridge: log.args.bridge === 0 ? ("AXELAR" as const) : ("LAYERZERO" as const),
        id: log.args.id,
      },
    }))

    const uniqueBlocks = [...new Set(executed.map((log: any) => log.blockNumber))]
    const blocks = await Promise.all(uniqueBlocks.map(bn => client.getBlock({ blockNumber: bn })))
    const blockTimestamps = new Map(blocks.map(b => [b.number, Number(b.timestamp)]))

    const formattedExecuted = executed.map((log: any) => ({
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
      timestamp: blockTimestamps.get(log.blockNumber) ?? 0,
      address: log.address,
      chainId,
      args: {
        from: log.args.from,
        to: log.args.to,
        amount: log.args.normalizedAmount,
        fee: log.args.fee,
        sourceChainId: Number(log.args.sourceChainId),
        bridge: log.args.bridge === 0 ? ("AXELAR" as const) : ("LAYERZERO" as const),
        id: log.args.id,
      },
    }))

    return [...formattedRequests, ...formattedExecuted]
  }

  /**
   * Gets status from external explorers
   */
  async getTransactionStatus(txHash: Hash, protocol: BridgeProtocol): Promise<TransactionStatus> {
    if (protocol === "LAYERZERO") {
      const resp = await fetch(`${API_ENDPOINTS.LAYERZERO_SCAN}/messages/tx/${txHash}`)
      const data: LayerZeroScanResponse = await resp.json()
      if (!data.data?.[0]) return { status: "pending" }
      const msg = data.data[0]
      return {
        status: msg.status.name === "DELIVERED" ? "completed" : "pending",
        srcTxHash: msg.source.tx.txHash,
        dstTxHash: msg.destination?.tx.txHash,
        timestamp: new Date(msg.created).getTime(),
      }
    } else {
      const resp = await fetch(`${API_ENDPOINTS.AXELARSCAN}/gmp?txHash=${txHash}`)
      const data: AxelarscanResponse = await resp.json()
      if (!data.data?.[0]) return { status: "pending" }
      const tx = data.data[0]
      return {
        status: tx.status === "executed" ? "completed" : "pending",
        srcTxHash: tx.sourceTxHash,
        dstTxHash: tx.destinationTxHash,
        timestamp: new Date(tx.createdAt).getTime(),
      }
    }
  }

  getExplorerLink(txHash: Hash, protocol: BridgeProtocol): string {
    return protocol === "LAYERZERO"
      ? `https://layerzeroscan.com/tx/${txHash}`
      : `https://axelarscan.io/gmp/${txHash}`
  }

  async getBridgeConfig(address: Address): Promise<BridgeConfig> {
    const [tokenBalance, nativeBalance, allowance] = await Promise.all([
      this.getG$Balance(address),
      this.publicClient.getBalance({ address }),
      this.getAllowance(address).catch(() => 0n),
    ])

    return {
      supportedChains: SUPPORTED_CHAINS,
      currentChainId: this.currentChainId,
      tokenBalance,
      nativeBalance,
      allowance,
      fees: this.fees,
      routeLimits: null, // Limits are checked per-route in getQuote
    }
  }

  static formatProtocolName(protocol: BridgeProtocol): string {
    return protocol === "LAYERZERO" ? "LayerZero" : "Axelar"
  }

  static formatChainName(chainId: number): string {
    const names: Record<number, string> = { 1: "Ethereum", 122: "Fuse", 42220: "Celo", 50: "XDC" }
    return names[chainId] || `Chain ${chainId}`
  }

  explorerLink(txHash: Hash, protocol: BridgeProtocol): string {
    return this.getExplorerLink(txHash, protocol)
  }

  private getChainNameForApi(chainId: number): string {
    const names: Record<number, string> = { 1: "ETH", 122: "FUSE", 42220: "CELO", 50: "XDC" }
    return names[chainId] || "UNKNOWN"
  }

  getCurrentChainId(): ChainId {
    return this.currentChainId
  }

  getSupportedChains(): Record<number, BridgeChain> {
    return SUPPORTED_CHAINS
  }

  async getHistory(address: Address, options?: EventOptions): Promise<(BridgeRequestEvent | ExecutedTransferEvent)[]> {
    return this.getChainHistory(address, this.publicClient, this.currentChainId, options)
  }

  static async getAllHistory(
    address: Address,
    clients: Record<number, PublicClient>,
    options?: EventOptions
  ): Promise<(BridgeRequestEvent | ExecutedTransferEvent)[]> {
    // We can't use 'this' in a static method, so we create a temporary instance or just use a helper
    // For simplicity, let's assume we can reuse the logic from getChainHistory but it needs a client.
    // Actually, I'll just implement it here to avoid complications.
    const results = await Promise.all(
      Object.entries(clients).map(async ([chainId, client]) => {
        try {
          // Re-implementing the core logic for static getAllHistory
          const contractAddress = BRIDGE_CONTRACT_ADDRESSES[Number(chainId)]
          if (!contractAddress) return []

          const currentBlock = await client.getBlockNumber()
          const lookback = HISTORY_BLOCK_LOOKBACK[Number(chainId)] || 10000n
          const fromBlock = options?.fromBlock || (currentBlock > lookback ? currentBlock - lookback : 0n)

          const [requests, executed] = await Promise.all([
            client.getContractEvents({
              address: contractAddress as Address,
              abi: MESSAGE_PASSING_BRIDGE_ABI,
              eventName: "BridgeRequest",
              args: { from: address },
              fromBlock,
            }),
            client.getContractEvents({
              address: contractAddress as Address,
              abi: MESSAGE_PASSING_BRIDGE_ABI,
              eventName: "ExecutedTransfer",
              args: { to: address },
              fromBlock,
            }),
          ])

          const formattedRequests = requests.map((log: any) => ({
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
            timestamp: Number(log.args.timestamp),
            address: log.address,
            chainId: Number(chainId),
            args: {
              from: log.args.from,
              to: log.args.to,
              amount: log.args.normalizedAmount,
              targetChainId: Number(log.args.targetChainId),
              timestamp: log.args.timestamp,
              bridge: log.args.bridge === 0 ? ("AXELAR" as const) : ("LAYERZERO" as const),
              id: log.args.id,
            },
          }))

          const uniqueBlocks = [...new Set(executed.map((log: any) => log.blockNumber))]
          const blocks = await Promise.all(uniqueBlocks.map(bn => client.getBlock({ blockNumber: bn })))
          const blockTimestamps = new Map(blocks.map(b => [b.number, Number(b.timestamp)]))

          const formattedExecuted = executed.map((log: any) => ({
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
            timestamp: blockTimestamps.get(log.blockNumber) ?? 0,
            address: log.address,
            chainId: Number(chainId),
            args: {
              from: log.args.from,
              to: log.args.to,
              amount: log.args.normalizedAmount,
              fee: log.args.fee,
              sourceChainId: Number(log.args.sourceChainId),
              bridge: log.args.bridge === 0 ? ("AXELAR" as const) : ("LAYERZERO" as const),
              id: log.args.id,
            },
          }))

          return [...formattedRequests, ...formattedExecuted]
        } catch {
          return []
        }
      })
    )

    return results.flat().sort((a, b) => b.timestamp - a.timestamp)
  }
}

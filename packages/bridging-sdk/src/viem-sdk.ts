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
  validateFeeCoverage,
} from "./utils/fees"
import {
  SUPPORTED_CHAINS,
  BRIDGE_CONTRACT_ADDRESSES,
  EVENT_QUERY_BATCH_SIZE,
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
} from "./types"

import { MESSAGE_PASSING_BRIDGE_ABI } from "./abi"

export class BridgingSDK {
  public publicClient: PublicClient
  private walletClient: WalletClient | null = null
  private currentChainId: ChainId
  private fees: GoodServerFeeResponse | null = null

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
  }

  setWalletClient(walletClient: WalletClient) {
    if (!walletClient.chain?.id || !SUPPORTED_CHAINS[walletClient.chain.id]) {
      throw new Error(`Unsupported chain ID: ${walletClient.chain?.id}`)
    }
    this.walletClient = walletClient
    this.currentChainId = walletClient.chain.id
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
  ): Promise<FeeEstimate> {
    // Protocol support validation
    if (protocol === "AXELAR" && (this.currentChainId === 50 || this.currentChainId === 122 || targetChainId === 50 || targetChainId === 122)) {
      throw new Error(`Axelar bridging is not supported for ${SUPPORTED_CHAINS[this.currentChainId].name} or ${SUPPORTED_CHAINS[targetChainId].name}`)
    }

    if (!this.fees) {
      await this.initialize()
    }

    return await getFeeEstimate(this.currentChainId, targetChainId, protocol)
  }

  /**
   * Generic bridge method that automatically selects the best protocol
   */
  async bridgeTo(
    target: Address,
    targetChainId: ChainId,
    amount: bigint,
    protocol: BridgeProtocol,
    msgValue?: bigint,
  ): Promise<TransactionReceipt> {
    return this.bridgeInternal({
      targetChainId,
      protocol,
      msgValue,
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
    msgValue?: bigint,
  ): Promise<TransactionReceipt> {
    return this.bridgeInternal({
      targetChainId,
      protocol: "LAYERZERO",
      msgValue,
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
    _gasRefundAddress?: Address,
    msgValue?: bigint,
  ): Promise<TransactionReceipt> {
    return this.bridgeInternal({
      targetChainId,
      protocol: "AXELAR",
      msgValue,
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
    msgValue?: bigint
    fn: "bridgeTo" | "bridgeToWithLzAdapterParams" | "bridgeToWithAxelar"
    args: TArgs
  }): Promise<TransactionReceipt> {
    if (!this.walletClient) {
      throw new Error("Wallet client not initialized")
    }

    const feeEstimate = await this.estimateFee(
      opts.targetChainId,
      opts.protocol,
    )

    const providedValue = opts.msgValue ?? 0n
    const feeValidation = validateFeeCoverage(providedValue, feeEstimate.fee)
    if (!feeValidation.isValid) {
      throw new Error(feeValidation.error)
    }

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
   * Fetches the combined, sorted bridge history for an address
   */
  async getHistory(address: Address, options?: EventOptions): Promise<(BridgeRequestEvent | ExecutedTransferEvent)[]> {
    const [requests, executed] = await Promise.all([
      this.getBridgeRequests(address, options),
      this.getExecutedTransfers(address, options)
    ])

    const history: (BridgeRequestEvent | ExecutedTransferEvent)[] = [...requests, ...executed]
    
    return history.sort((a, b) => {
      if (a.blockNumber < b.blockNumber) return 1
      if (a.blockNumber > b.blockNumber) return -1
      return 0
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
    const fromBlock = options?.fromBlock || (currentBlock > 50000n ? currentBlock - 50000n : 0n)
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
    const fromBlock = options?.fromBlock || (currentBlock > 50000n ? currentBlock - 50000n : 0n)
    const toBlock = options?.toBlock || "latest"
    const limit = options?.limit || EVENT_QUERY_BATCH_SIZE

    try {
      const logs = await this.publicClient.getContractEvents({
        address: contractAddress as Address,
        abi: MESSAGE_PASSING_BRIDGE_ABI,
        eventName: "ExecutedTransfer",
        args: { from: address },
        fromBlock,
        toBlock,
      })

      return (logs as any[]).slice(0, limit).map((log) => ({
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        address: log.address,
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
    const response = await fetch(`${API_ENDPOINTS.LAYERZERO_SCAN}/message?txHash=${txHash}`)
    const data: LayerZeroScanResponse = await response.json()
    if (!data.messages || data.messages.length === 0) return { status: "pending" }
    const message = data.messages[0]
    return {
      status: message.status === "DELIVERED" ? "completed" : message.status === "FAILED" ? "failed" : "pending",
      srcTxHash: message.srcTxHash,
      dstTxHash: message.dstTxHash,
      timestamp: message.timestamp * 1000,
    }
  }

  private async getAxelarStatus(txHash: Hash): Promise<TransactionStatus> {
    const response = await fetch(`${API_ENDPOINTS.AXELARSCAN}/gmp?txHash=${txHash}`)
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

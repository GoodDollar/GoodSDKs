import {
  PublicClient,
  WalletClient,
  parseAbi,
  type Address,
  type Hash,
  type TransactionReceipt,
  type SimulateContractParameters,
} from "viem"
import { normalizeAmount, denormalizeAmount } from "./utils/decimals"
import {
  getFeeEstimate,
  validateFeeCoverage,
  validateSufficientBalance,
} from "./utils/fees"
import { getTransactionStatus, getExplorerLink } from "./utils/tracking"
import {
  SUPPORTED_CHAINS,
  BRIDGE_CONTRACT_ADDRESSES,
  EVENT_QUERY_BATCH_SIZE,
} from "./constants"
import type {
  BridgeProtocol,
  ChainId,
  BridgeParams,
  BridgeParamsWithLz,
  BridgeParamsWithAxelar,
  CanBridgeResult,
  FeeEstimate,
  BridgeRequestEvent,
  ExecutedTransferEvent,
  EventOptions,
  TransactionStatus,
} from "./types"

import { MESSAGE_PASSING_BRIDGE_ABI } from "./abi"

export class BridgingSDK {
  public publicClient: PublicClient
  private walletClient: WalletClient | null = null
  private currentChainId: ChainId

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
   */
  async estimateFee(
    targetChainId: ChainId,
    protocol: BridgeProtocol,
  ): Promise<FeeEstimate> {
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
      args: [target, targetChainId, amount, protocol === "LAYERZERO" ? 0 : 1],
    })
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
    gasRefundAddress?: Address,
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
   * Fetches BridgeRequest events for an address
   */
  async getBridgeRequests(
    address: Address,
    options?: EventOptions,
  ): Promise<BridgeRequestEvent[]> {
    const contractAddress = BRIDGE_CONTRACT_ADDRESSES[this.currentChainId]
    if (!contractAddress) {
      throw new Error(
        `Bridge contract not deployed on chain ${this.currentChainId}`,
      )
    }

    const fromBlock = options?.fromBlock || 0n
    const toBlock = options?.toBlock || "latest"
    const limit = options?.limit || EVENT_QUERY_BATCH_SIZE

    try {
      const logs = await this.publicClient.getContractEvents({
        address: contractAddress as Address,
        abi: MESSAGE_PASSING_BRIDGE_ABI,
        eventName: "BridgeRequest",
        args: {
          from: address,
        },
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
          bridge: log.args.bridge === 0 ? "LAYERZERO" : "AXELAR",
          id: log.args.id as bigint,
        },
      }))
    } catch (error) {
      throw new Error(
        `Failed to fetch bridge requests: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  /**
   * Fetches ExecutedTransfer events for an address
   */
  async getExecutedTransfers(
    address: Address,
    options?: EventOptions,
  ): Promise<ExecutedTransferEvent[]> {
    const contractAddress = BRIDGE_CONTRACT_ADDRESSES[this.currentChainId]
    if (!contractAddress) {
      throw new Error(
        `Bridge contract not deployed on chain ${this.currentChainId}`,
      )
    }

    const fromBlock = options?.fromBlock || 0n
    const toBlock = options?.toBlock || "latest"
    const limit = options?.limit || EVENT_QUERY_BATCH_SIZE

    try {
      const logs = await this.publicClient.getContractEvents({
        address: contractAddress as Address,
        abi: MESSAGE_PASSING_BRIDGE_ABI,
        eventName: "ExecutedTransfer",
        args: {
          from: address,
        },
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
          bridge: log.args.bridge === 0 ? "LAYERZERO" : "AXELAR",
          id: log.args.id as bigint,
        },
      }))
    } catch (error) {
      throw new Error(
        `Failed to fetch executed transfers: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  /**
   * Gets the status of a bridge transaction
   */
  async getTransactionStatus(
    txHash: Hash,
    protocol: BridgeProtocol,
  ): Promise<TransactionStatus> {
    return await getTransactionStatus(txHash, protocol)
  }

  /**
   * Generates an explorer link for a bridge transaction
   */
  getExplorerLink(txHash: Hash, protocol: BridgeProtocol): string {
    return getExplorerLink(txHash, protocol)
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

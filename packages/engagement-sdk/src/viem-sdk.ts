import {
  Address,
  PublicClient,
  WalletClient,
  type SimulateContractParameters,
} from "viem"
import { waitForTransactionReceipt } from "viem/actions"
import devdeployments from "@goodsdks/engagement-contracts/ignition/deployments/development-celo/deployed_addresses.json"
import prod from "@goodsdks/engagement-contracts/ignition/deployments/production-celo/deployed_addresses.json"
import { EngagementRewards as engagementRewardsABI } from "./abi/abis"
export const DEV_REWARDS_CONTRACT = devdeployments[
  "EngagementRewardsProxy#ERC1967Proxy"
] as `0x${string}`
export const REWARDS_CONTRACT = prod?.[
  "EngagementRewardsProxy#ERC1967Proxy"
] as `0x${string}`
import {
  DEFAULT_EVENT_BATCH_SIZE,
  DEFAULT_EVENT_LOOKBACK,
  WAIT_DELAY,
  fetchInBlockBatches,
} from "./utils/rpc"
import {
  type StorageLike,
  type StorageLogger,
  readProgressBlock,
  writeProgressBlock,
  clearStorageKey,
} from "./utils/storage"
export type { StorageLike } from "./utils/storage"

export const EVENT_CACHE_PREFIX = "goodsdks:engagement-rewards"

export interface EngagementRewardsSDKOptions {
  cacheStorage?: StorageLike
}

export interface AppInfo {
  rewardReceiver: Address
  userAndInviterPercentage: number
  userPercentage: number
  description: string
  url: string
  email: string
}

export interface RewardEvent {
  tx: `0x${string}`
  block: bigint
  timestamp?: number // Optional as we might not always have block timestamp
  user: `0x${string}` // Changed from optional to required as per contract event
  inviter: `0x${string}` // Changed from optional to required as per contract event
  appReward: bigint // Changed from optional to required as per contract event
  userAmount: bigint // Changed from optional to required as per contract event
  inviterAmount: bigint // Changed from optional to required as per contract event
}

export interface AppEvent {
  owner: Address
  rewardReceiver: Address
  userAndInviterPercentage: number
  userPercentage: number
  description: string
  url: string
  email: string
  block: bigint
}

export interface GetAppRewardEventsOptions {
  /** Optional inviter to filter server-side; skips local filtering. */
  inviter?: Address
  /**
   * Number of blocks to request per batch when walking the chain.
   * Defaults to {@link DEFAULT_EVENT_BATCH_SIZE}.
   */
  batchSize?: bigint
  /**
   * How many blocks to look back from the latest block.
   * Defaults to {@link DEFAULT_EVENT_LOOKBACK}.
   */
  blocksAgo?: bigint
  /** Override the default localStorage key derivation. */
  cacheKey?: string
  /** Skip storing progress in localStorage. */
  disableCache?: boolean
  /** Remove any stored progress before fetching. */
  resetCache?: boolean
}

export class EngagementRewardsSDK {
  private publicClient: PublicClient
  private walletClient: WalletClient
  private contractAddress: Address
  private cacheStorage?: StorageLike
  private debug: boolean = false
  private storageLogger: StorageLogger

  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient,
    contractAddress: Address,
    options?: EngagementRewardsSDKOptions & { debug?: boolean },
  ) {
    this.publicClient = publicClient
    this.walletClient = walletClient
    this.contractAddress = contractAddress
    this.cacheStorage = options?.cacheStorage
    this.debug = options?.debug ?? false
    this.storageLogger = (message, context) => {
      this.logDebug(message, context)
    }
  }

  private logDebug(message: string, context?: Record<string, unknown>) {
    if (!this.debug) return
    if (context) {
      console.log("[goodsdks:engagement-sdk]", message, context)
    } else {
      console.log("[goodsdks:engagement-sdk]", message)
    }
  }

  private getCacheStorage(): StorageLike | undefined {
    if (this.cacheStorage) {
      return this.cacheStorage
    }

    const globalObject = globalThis as {
      localStorage?: StorageLike
    }
    if (!globalObject.localStorage) {
      this.logDebug("cache storage unavailable: localStorage missing")
      return undefined
    }

    try {
      const key = `${EVENT_CACHE_PREFIX}:check`
      globalObject.localStorage.setItem(key, key)
      globalObject.localStorage.removeItem(key)
      this.cacheStorage = globalObject.localStorage
      return this.cacheStorage
    } catch (error) {
      this.logDebug("cache storage unavailable: localStorage access failed", {
        error,
      })
      return undefined
    }
  }

  private buildCacheKey(app: Address, inviter?: Address, customKey?: string) {
    if (customKey) return customKey
    return [
      EVENT_CACHE_PREFIX,
      this.contractAddress,
      app,
      inviter ?? "all",
    ].join(":")
  }

  private logBatchFailure(
    range: { from: bigint; to: bigint },
    batchSize: bigint,
    error: unknown,
  ) {
    this.logDebug("failed logs batch", {
      batchSize: batchSize.toString(),
      fromBlock: range.from.toString(),
      toBlock: range.to.toString(),
      error,
    })
  }

  private async submitAndWait(
    simulateParams: SimulateContractParameters,
    onHash?: (hash: `0x${string}`) => void,
  ) {
    const [account] = await this.walletClient.getAddresses()
    const { request } = await this.publicClient.simulateContract({
      account,
      ...simulateParams,
    })

    const hash = await this.walletClient.writeContract(request)
    if (onHash) onHash(hash)

    // Add delay before waiting for receipt
    await new Promise((resolve) => setTimeout(resolve, WAIT_DELAY))

    return waitForTransactionReceipt(this.publicClient, {
      hash,
    })
  }

  async applyApp(
    app: Address,
    appInfo: AppInfo,
    onHash?: (hash: `0x${string}`) => void,
  ) {
    return this.submitAndWait(
      {
        address: this.contractAddress,
        abi: engagementRewardsABI,
        functionName: "applyApp",
        args: [
          app,
          appInfo.rewardReceiver,
          BigInt(appInfo.userAndInviterPercentage),
          BigInt(appInfo.userPercentage),
          appInfo.description,
          appInfo.url,
          appInfo.email,
        ],
      },
      onHash,
    )
  }

  async approve(app: Address, onHash?: (hash: `0x${string}`) => void) {
    return this.submitAndWait(
      {
        address: this.contractAddress,
        abi: engagementRewardsABI,
        functionName: "approve",
        args: [app],
      },
      onHash,
    )
  }

  async updateAppSettings(
    app: Address,
    rewardReceiver: Address,
    userInviterPercentage: number,
    userPercentage: number,
    onHash?: (hash: `0x${string}`) => void,
  ) {
    return this.submitAndWait(
      {
        address: this.contractAddress,
        abi: engagementRewardsABI,
        functionName: "updateAppSettings",
        args: [
          app,
          rewardReceiver,
          BigInt(userInviterPercentage),
          BigInt(userPercentage),
        ],
      },
      onHash,
    )
  }

  async getAppInfo(app: Address) {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: engagementRewardsABI,
      functionName: "registeredApps",
      args: [app],
    })
  }

  async nonContractAppClaim(
    app: Address,
    inviter: Address,
    nonce: bigint,
    userSignature: `0x${string}`,
    appSignature: `0x${string}`,
    onHash?: (hash: `0x${string}`) => void,
  ) {
    return this.submitAndWait(
      {
        address: this.contractAddress,
        abi: engagementRewardsABI,
        functionName: "nonContractAppClaim",
        args: [app, inviter, nonce, userSignature, appSignature],
      },
      onHash,
    )
  }

  async prepareClaimSignature(
    app: Address,
    inviter: Address,
    validUntilBlock: bigint,
    description: string,
  ) {
    const domain = {
      name: "EngagementRewards",
      version: "1.0",
      chainId: await this.publicClient.getChainId(),
      verifyingContract: this.contractAddress,
    }

    const types = {
      Claim: [
        { name: "app", type: "address" },
        { name: "inviter", type: "address" },
        { name: "validUntilBlock", type: "uint256" },
        { name: "description", type: "string" },
      ],
    }

    const message = {
      app,
      inviter,
      validUntilBlock,
      description,
    }

    return { domain, types, message }
  }

  async signClaim(
    app: Address,
    inviter: Address,
    validUntilBlock: bigint,
  ): Promise<`0x${string}`> {
    const [account] = await this.walletClient.getAddresses()
    if (!account) throw new Error("No account available")

    const appInfo = await this.getAppInfo(app)
    const { domain, types, message } = await this.prepareClaimSignature(
      app,
      inviter,
      validUntilBlock,
      appInfo[9], // description,
    )

    return this.walletClient.signTypedData({
      account,
      domain,
      types,
      primaryType: "Claim",
      message,
    })
  }

  // Add new method to prepare app signature
  async prepareAppSignature(
    app: Address,
    user: Address,
    validUntilBlock: bigint,
  ) {
    const domain = {
      name: "EngagementRewards",
      version: "1.0",
      chainId: await this.publicClient.getChainId(),
      verifyingContract: this.contractAddress,
    }

    const types = {
      AppClaim: [
        { name: "app", type: "address" },
        { name: "user", type: "address" },
        { name: "validUntilBlock", type: "uint256" },
      ],
    }

    const message = {
      app,
      user,
      validUntilBlock,
    }

    return { domain, types, message }
  }

  async getPendingApps() {
    return (await this.getAppliedApps()).filter((_) => _.isApproved === false)
  }

  async getRegisteredApps() {
    return (await this.getAppliedApps()).filter((_) => _.isApproved === true)
  }

  async getAppliedApps() {
    const apps = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: engagementRewardsABI,
      functionName: "getAppliedApps",
    })

    return apps
  }

  async getAppRewards(app: Address) {
    const stats = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: engagementRewardsABI,
      functionName: "appsStats",
      args: [app],
    })

    return {
      totalRewards: stats[1] + stats[2] + stats[3], // totalAppRewards + totalUserRewards + totalInviterRewards
      appRewards: stats[1], // totalAppRewards
      userRewards: stats[2], // totalUserRewards
      inviterRewards: stats[3], // totalInviterRewards
      rewardEventCount: Number(stats[0]), // numberOfRewards
    }
  }

  async getCachedFromBlock(
    app: Address,
    inviter?: Address,
    cacheKey?: string,
    resetCache?: boolean,
  ): Promise<bigint | undefined> {
    const storage = this.getCacheStorage()
    if (!storage) {
      this.logDebug("cache storage unavailable: skipping read", {
        app,
        inviter,
        cacheKey,
      })
      return undefined
    }

    const storageKey = this.buildCacheKey(app, inviter, cacheKey)
    if (resetCache) {
      this.logDebug("resetting cached progress block", { cacheKey: storageKey })
      clearStorageKey(storage, storageKey, this.storageLogger)
      return undefined
    }

    return readProgressBlock(storage, storageKey, this.storageLogger)
  }

  /**
   * Fetch RewardClaimed logs for an app, optionally narrowed by inviter or
   * custom log pagination parameters.
   */
  async getAppRewardEvents(
    app: Address,
    options: GetAppRewardEventsOptions = {},
  ): Promise<RewardEvent[]> {
    const {
      inviter,
      batchSize = DEFAULT_EVENT_BATCH_SIZE,
      blocksAgo = DEFAULT_EVENT_LOOKBACK,
      cacheKey,
      disableCache = false,
      resetCache = false,
    } = options

    if (blocksAgo < 0n) {
      throw new Error("blocksAgo must be zero or greater")
    }

    const latestBlock = await this.publicClient.getBlockNumber()
    let fromBlock =
      blocksAgo === 0n
        ? latestBlock
        : blocksAgo >= latestBlock
          ? 0n
          : latestBlock - blocksAgo

    const storedFromBlock = !disableCache
      ? await this.getCachedFromBlock(app, inviter, cacheKey, resetCache)
      : undefined

    if (storedFromBlock !== undefined && storedFromBlock > latestBlock) {
      return []
    }

    if (storedFromBlock !== undefined && storedFromBlock > fromBlock) {
      fromBlock = storedFromBlock
    }

    if (fromBlock > latestBlock) {
      return []
    }

    const rewardEvents = await fetchInBlockBatches({
      batchSize,
      fromBlock,
      toBlock: latestBlock,
      promiseCreator: (rangeStart, rangeEnd) =>
        this.publicClient.getContractEvents({
          address: this.contractAddress,
          abi: engagementRewardsABI,
          eventName: "RewardClaimed",
          args: inviter ? { app, inviter } : { app },
          fromBlock: rangeStart,
          toBlock: rangeEnd,
        }),
      onBatchFailure: (error, range) => {
        this.logBatchFailure(range, batchSize, error)
      },
    })

    if (!disableCache) {
      const storage = this.getCacheStorage()
      const key = this.buildCacheKey(app, inviter, cacheKey)
      if (!storage) {
        this.logDebug("cache storage unavailable: skipping write", {
          cacheKey: key,
        })
      } else {
        // remember last processed block so subsequent runs can resume quickly
        this.logDebug("persisting cached progress block", {
          cacheKey: key,
          nextBlock: (latestBlock + 1n).toString(),
        })
        writeProgressBlock(storage, key, latestBlock + 1n, this.storageLogger)
      }
    }

    return rewardEvents.map((log) => ({
      tx: log.transactionHash,
      block: log.blockNumber,
      user: log.args.user as `0x${string}`,
      inviter: log.args.inviter as `0x${string}`,
      appReward: log.args.appReward as bigint,
      userAmount: log.args.userAmount as bigint,
      inviterAmount: log.args.inviterAmount as bigint,
    }))
  }

  async getAppHistory(app: Address): Promise<AppEvent[]> {
    const latestBlock = await this.publicClient.getBlockNumber()
    const earliestBlock =
      DEFAULT_EVENT_LOOKBACK >= latestBlock
        ? 0n
        : latestBlock - DEFAULT_EVENT_LOOKBACK

    const events = await fetchInBlockBatches({
      batchSize: DEFAULT_EVENT_BATCH_SIZE,
      fromBlock: earliestBlock,
      toBlock: latestBlock,
      promiseCreator: (fromBlock, toBlock) =>
        this.publicClient.getContractEvents({
          address: this.contractAddress,
          abi: engagementRewardsABI,
          eventName: "AppApplied",
          args: { app },
          fromBlock,
          toBlock,
        }),
      onBatchFailure: (error, range) => {
        this.logBatchFailure(range, DEFAULT_EVENT_BATCH_SIZE, error)
      },
    })

    return events.map((log) => ({
      owner: log.args.owner as Address,
      rewardReceiver: log.args.rewardReceiver as Address,
      userAndInviterPercentage: Number(log.args.userAndInviterPercentage),
      userPercentage: Number(log.args.userPercentage),
      description: log.args.description as string,
      url: log.args.url as string,
      email: log.args.email as string,
      block: log.blockNumber,
    }))
  }

  async getCurrentBlockNumber() {
    return this.publicClient.getBlockNumber()
  }

  async getRewardAmount() {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: engagementRewardsABI,
      functionName: "rewardAmount",
    })
  }

  async canClaim(app: Address, user: Address) {
    try {
      await this.publicClient.readContract({
        address: this.contractAddress,
        abi: engagementRewardsABI,
        functionName: "canClaim",
        args: [app, user],
      })
      return true
    } catch (error) {
      return false
    }
  }
}

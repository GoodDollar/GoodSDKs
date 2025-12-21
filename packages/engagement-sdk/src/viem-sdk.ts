import {
  Address,
  PublicClient,
  WalletClient,
  type SimulateContractParameters,
} from "viem"
import { waitForTransactionReceipt } from "viem/actions"
import devdeployments from "@goodsdks/engagement-contracts/ignition/deployments/development-celo/deployed_addresses.json"
import prod from "@goodsdks/engagement-contracts/ignition/deployments/production-celo/deployed_addresses.json"
import {
  EngagementRewards as engagementRewardsABI,
  IIdentity as identityABI,
} from "./abi/abis"
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
  promisePool,
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

export interface RewardEventExtended extends RewardEvent {
  userDateAdded?: bigint
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

export interface GetAppRewardEventsExtendedOptions
  extends GetAppRewardEventsOptions {
  /** Identity contract address for fetching dateAdded. */
  identityContractAddress?: Address
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

    // const storedFromBlock = !disableCache
    //   ? await this.getCachedFromBlock(app, inviter, cacheKey, resetCache)
    //   : undefined

    // this.logDebug("storedFromBlock", {
    //   storedFromBlock,
    //   fromBlock,
    //   latestBlock,
    // })
    // if (storedFromBlock !== undefined && storedFromBlock > latestBlock) {
    //   return []
    // }

    // if (storedFromBlock !== undefined && storedFromBlock > fromBlock) {
    //   fromBlock = storedFromBlock
    // }

    // if (fromBlock > latestBlock) {
    //   return []
    // }

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

  /**
   * Fetch dateAdded for multiple addresses using multicall in batches of 500.
   * Processes with concurrent workers via promisePool for optimal throughput.
   */
  private async getIdentitiesDateAdded(
    addresses: Address[],
    identityContractAddress: Address,
    concurrency: number = 3,
  ): Promise<Map<Address, bigint | undefined>> {
    const result = new Map<Address, bigint | undefined>()

    if (addresses.length === 0) {
      return result
    }

    const BATCH_SIZE = 300
    const uniqueAddresses = Array.from(new Set(addresses))

    // Create all batches upfront
    const batches: Address[][] = []
    for (let i = 0; i < uniqueAddresses.length; i += BATCH_SIZE) {
      batches.push(uniqueAddresses.slice(i, i + BATCH_SIZE))
    }

    // Create tasks for promise pool
    const tasks = batches.map((batch, idx) => async () => {
      try {
        const callResults = await this.publicClient.multicall({
          contracts: batch.map((address) => ({
            address: identityContractAddress,
            abi: identityABI,
            functionName: "identities",
            args: [address],
          })),
          allowFailure: true,
        })

        batch.forEach((address, callIndex) => {
          const callResult = callResults[callIndex]
          if (
            callResult.status === "success" &&
            callResult.result &&
            Array.isArray(callResult.result)
          ) {
            // dateAdded is the second element in the Identity struct
            const dateAdded = callResult.result[1] as bigint | undefined
            result.set(address, dateAdded)
          } else {
            result.set(address, undefined)
          }
        })

        this.logDebug("fetched identity dateAdded batch", {
          batchIndex: idx,
          batchSize: batch.length,
          successCount: callResults.filter((r) => r.status === "success")
            .length,
        })
      } catch (error) {
        this.logDebug("failed to fetch identity dateAdded batch", {
          batchIndex: idx,
          error,
        })

        // Mark all addresses in this batch as undefined
        batch.forEach((address) => {
          result.set(address, undefined)
        })
      }
    })

    // Execute tasks with concurrency limit
    await promisePool(tasks, concurrency)

    return result
  }

  /**
   * Fetch RewardClaimed logs for an app with extended identity data (dateAdded).
   * Combines getAppRewardEvents with identity contract queries in parallel.
   */
  async getAppRewardEventsExtended(
    app: Address,
    options: GetAppRewardEventsExtendedOptions = {
      identityContractAddress: "0xC361A6E67822a0EDc17D899227dd9FC50BD62F42",
    },
  ): Promise<RewardEventExtended[]> {
    const { identityContractAddress, ...rewardEventOptions } = options

    // Fetch reward events
    const rewardEvents = await this.getAppRewardEvents(app, rewardEventOptions)

    if (!identityContractAddress || rewardEvents.length === 0) {
      this.logDebug("skipping identity augmentation", {
        hasIdentityAddress: !!identityContractAddress,
        eventCount: rewardEvents.length,
      })
      return rewardEvents.map((event) => ({
        ...event,
        userDateAdded: undefined,
      }))
    }

    try {
      // Extract unique user addresses from reward events
      const userAddresses = Array.from(
        new Set(rewardEvents.map((event) => event.user)),
      )

      // Fetch dateAdded in parallel with reward events
      const dateAddedMap = await this.getIdentitiesDateAdded(
        userAddresses,
        identityContractAddress,
      )

      // Augment reward events with dateAdded
      const extendedEvents: RewardEventExtended[] = rewardEvents.map(
        (event) => ({
          ...event,
          userDateAdded: dateAddedMap.get(event.user),
        }),
      )

      this.logDebug("augmented reward events with identity data", {
        eventCount: extendedEvents.length,
        augmentedWithDateAdded: extendedEvents.filter(
          (e) => e.userDateAdded !== undefined,
        ).length,
      })

      return extendedEvents
    } catch (error) {
      this.logDebug("failed to augment reward events with identity data", {
        error,
      })
      // Fallback: return events without dateAdded
      return rewardEvents.map((event) => ({
        ...event,
        userDateAdded: undefined,
      }))
    }
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

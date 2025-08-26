import {
  Address,
  PublicClient,
  WalletClient,
  parseAbi,
  type SimulateContractParameters,
} from "viem"
import { waitForTransactionReceipt } from "viem/actions"
import devdeployments from "@goodsdks/engagement-contracts/ignition/deployments/development-celo/deployed_addresses.json"
import prod from "@goodsdks/engagement-contracts/ignition/deployments/production-celo/deployed_addresses.json"
import { range, flatten } from "lodash"
import { EngagementRewards as engagementRewardsABI } from "./abi/abis"
export const DEV_REWARDS_CONTRACT = devdeployments[
  "EngagementRewardsProxy#ERC1967Proxy"
] as `0x${string}`
export const REWARDS_CONTRACT = prod?.[
  "EngagementRewardsProxy#ERC1967Proxy"
] as `0x${string}`

const BLOCKS_RANGE = BigInt(10000)
const BLOCKS_AGO = BigInt(500000)
const WAIT_DELAY = 5000 // 1 second delay

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

export class EngagementRewardsSDK {
  private publicClient: PublicClient
  private walletClient: WalletClient
  private contractAddress: Address

  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient,
    contractAddress: Address,
  ) {
    this.publicClient = publicClient
    this.walletClient = walletClient
    this.contractAddress = contractAddress
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

  async getLogsBatches<
    P extends (startBlock: number, endBlock: number) => Promise<any>,
  >(
    batchSize: bigint,
    blocksAgo: bigint,
    promiseCreator: P,
  ): Promise<Awaited<ReturnType<P>>> {
    const curBlock = await this.publicClient.getBlockNumber()
    const startBlock = Number(curBlock - blocksAgo)
    const ranges = range(
      Number(startBlock),
      Number(curBlock),
      Number(batchSize),
    )
    return flatten(
      await Promise.all(
        ranges.map((toBlock, i) =>
          promiseCreator(toBlock - Number(batchSize), toBlock).catch((e) => {
            console.log("failed logs batch", { batchSize, toBlock, e })
            return []
          }),
        ),
      ),
    ) as Awaited<ReturnType<P>>
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

  async getAppRewardEvents(app: Address): Promise<RewardEvent[]> {
    const rewardEvents = await this.getLogsBatches(
      BLOCKS_RANGE,
      BLOCKS_AGO,
      (startBlock, endBlock) =>
        this.publicClient.getContractEvents({
          address: this.contractAddress,
          abi: engagementRewardsABI,
          eventName: "RewardClaimed",
          args: { app },
          fromBlock: BigInt(startBlock),
          toBlock: BigInt(endBlock),
        }),
    )

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
    const events = await this.getLogsBatches(
      BLOCKS_RANGE,
      BLOCKS_AGO,
      (startBlock, endBlock) =>
        this.publicClient.getContractEvents({
          address: this.contractAddress,
          abi: engagementRewardsABI,
          eventName: "AppApplied",
          args: { app },
          fromBlock: BigInt(startBlock),
          toBlock: BigInt(endBlock),
        }),
    )

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

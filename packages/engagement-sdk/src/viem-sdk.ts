import {
  Address,
  PublicClient,
  WalletClient,
  parseAbi,
  type SimulateContractParameters,
} from "viem";
import { waitForTransactionReceipt } from "viem/actions";

import devdeployments from "@goodsdks/engagement-contracts/ignition/deployments/development-celo/deployed_addresses.json";
// import prod from "@goodsdks/engagement-contracts/ignition/deployments/chain-42220/deployed_addresses.json";
const prod = {} as typeof devdeployments;

export const DEV_REWARDS_CONTRACT =
  devdeployments["EngagementRewardsProxy#ERC1967Proxy"];
export const REWARDS_CONTRACT = prod?.["EngagementRewardsProxy#ERC1967Proxy"];

const BLOCKS_AGO = BigInt(100000);
const WAIT_DELAY = 5000; // 1 second delay

//TODO:
// create guide how to integrate claiming with/without signature
// allow update app details screen with all the details
//
const engagementRewardsABI = parseAbi([
  "function applyApp(address app, address rewardReceiver, uint8 userInviterPercentage, uint8 userPercentage, string description, string url, string email) external",
  "function approve(address app) external",
  "function canClaim(address app, address user) external view returns(bool)",
  "function updateAppSettings(address app, address rewardReceiver, uint8 userInviterPercentage, uint8 userPercentage) external",
  "function registeredApps(address) external view returns (address owner, address rewardReceiver, uint96 totalRewardsClaimed, uint32 registeredAt, uint32 lastResetAt, uint8 userAndInviterPercentage, uint8 userPercentage, bool isRegistered, bool isApproved, string description, string url, string email)",
  "function appsStats(address) external view returns (uint96 numberOfRewards, uint96 totalAppRewards, uint96 totalUserRewards, uint96 totalInviterRewards)",
  "function appClaim(address inviter, uint256 nonce, bytes memory signature) external returns (bool)",
  "function appClaim(address inviter, uint256 nonce, bytes memory signature, uint8 userAndInviterPercentage, uint8 userPercentage) external returns (bool)",
  "function eoaClaim(address app, address inviter, uint256 nonce, bytes memory signature) external returns (bool)",
  "function nonContractAppClaim(address app, address inviter, uint256 nonce, bytes memory userSignature, bytes memory appSignature) external returns (bool)",
  "event AppApplied(address indexed app, address indexed owner, address rewardReceiver, uint256 userAndInviterPercentage, uint256 userPercentage, string description, string url, string email)",
  "event AppApproved(address indexed app)",
  "event AppSettingsUpdated(address indexed app, uint256 userAndInviterPercentage, uint256 userPercentage)",
  "event RewardClaimed(address indexed app, address indexed user, address indexed inviter, uint256 appReward, uint256 userAmount, uint256 inviterAmount)",
  "event RewardAmountUpdated(uint256 newAmount)",
]);

export interface AppInfo {
  rewardReceiver: Address;
  userAndInviterPercentage: number;
  userPercentage: number;
  description: string;
  url: string;
  email: string;
}

export interface RewardEvent {
  tx: `0x${string}`;
  block: bigint;
  timestamp?: number; // Optional as we might not always have block timestamp
  user: `0x${string}`; // Changed from optional to required as per contract event
  inviter: `0x${string}`; // Changed from optional to required as per contract event
  appReward: bigint; // Changed from optional to required as per contract event
  userAmount: bigint; // Changed from optional to required as per contract event
  inviterAmount: bigint; // Changed from optional to required as per contract event
}

export interface AppEvent {
  owner: Address;
  rewardReceiver: Address;
  userAndInviterPercentage: number;
  userPercentage: number;
  description: string;
  url: string;
  email: string;
  block: bigint;
}

export class EngagementRewardsSDK {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private contractAddress: Address;

  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient,
    contractAddress: Address,
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.contractAddress = contractAddress;
  }

  private async submitAndWait(
    simulateParams: SimulateContractParameters,
    onHash?: (hash: `0x${string}`) => void,
  ) {
    const [account] = await this.walletClient.getAddresses();
    const { request } = await this.publicClient.simulateContract({
      account,
      ...simulateParams,
    });

    const hash = await this.walletClient.writeContract(request);
    if (onHash) onHash(hash);

    // Add delay before waiting for receipt
    await new Promise((resolve) => setTimeout(resolve, WAIT_DELAY));

    return waitForTransactionReceipt(this.publicClient, {
      hash,
    });
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
    );
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
    );
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
    );
  }

  async getAppInfo(app: Address) {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: engagementRewardsABI,
      functionName: "registeredApps",
      args: [app],
    });
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
    );
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
    };

    const types = {
      Claim: [
        { name: "app", type: "address" },
        { name: "inviter", type: "address" },
        { name: "validUntilBlock", type: "uint256" },
        { name: "description", type: "string" },
      ],
    };

    const message = {
      app,
      inviter,
      validUntilBlock,
      description,
    };

    return { domain, types, message };
  }

  async signClaim(
    app: Address,
    inviter: Address,
    validUntilBlock: bigint,
  ): Promise<`0x${string}`> {
    const [account] = await this.walletClient.getAddresses();
    if (!account) throw new Error("No account available");

    const appInfo = await this.getAppInfo(app);
    const { domain, types, message } = await this.prepareClaimSignature(
      app,
      inviter,
      validUntilBlock,
      appInfo[9], // description,
    );

    return this.walletClient.signTypedData({
      account,
      domain,
      types,
      primaryType: "Claim",
      message,
    });
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
    };

    const types = {
      AppClaim: [
        { name: "app", type: "address" },
        { name: "user", type: "address" },
        { name: "validUntilBlock", type: "uint256" },
      ],
    };

    const message = {
      app,
      user,
      validUntilBlock,
    };

    return { domain, types, message };
  }

  async getPendingApps() {
    const curBlock = await this.publicClient.getBlockNumber();
    const [applyEvents, approvedEvents] = await Promise.all([
      this.publicClient.getContractEvents({
        address: this.contractAddress,
        abi: engagementRewardsABI,
        eventName: "AppApplied",
        fromBlock: curBlock - BigInt(BLOCKS_AGO),
      }),
      await this.publicClient.getContractEvents({
        address: this.contractAddress,
        abi: engagementRewardsABI,
        eventName: "AppApproved",
        fromBlock: curBlock - BigInt(BLOCKS_AGO),
      }),
    ]);

    const approvedApps = new Set<string>();
    approvedEvents
      .map((_) => _.args.app)
      .filter((_) => _ !== undefined)
      .forEach((app) => {
        approvedApps.add(app.toLowerCase());
      });

    return applyEvents
      .map((_) => _.args.app?.toLowerCase())
      .filter((_) => _ !== undefined)
      .filter((app) => !approvedApps.has(app));
  }

  async getRegisteredApps() {
    const curBlock = await this.publicClient.getBlockNumber();
    const approvedEvents = await this.publicClient.getContractEvents({
      address: this.contractAddress,
      abi: engagementRewardsABI,
      eventName: "AppApproved",
      fromBlock: curBlock - BigInt(BLOCKS_AGO),
    });

    return approvedEvents.map((_) => _.args.app).filter((_) => _ !== undefined);
  }

  async getAppRewards(app: Address) {
    const stats = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: engagementRewardsABI,
      functionName: "appsStats",
      args: [app],
    });

    return {
      totalRewards: stats[1] + stats[2] + stats[3], // totalAppRewards + totalUserRewards + totalInviterRewards
      appRewards: stats[1], // totalAppRewards
      userRewards: stats[2], // totalUserRewards
      inviterRewards: stats[3], // totalInviterRewards
      rewardEventCount: Number(stats[0]), // numberOfRewards
    };
  }

  async getAppRewardEvents(app: Address): Promise<RewardEvent[]> {
    const curBlock = await this.publicClient.getBlockNumber();

    const rewardEvents = await this.publicClient.getContractEvents({
      address: this.contractAddress,
      abi: engagementRewardsABI,
      eventName: "RewardClaimed",
      args: { app },
      fromBlock: curBlock - BigInt(BLOCKS_AGO),
    });

    return rewardEvents.map((log) => ({
      tx: log.transactionHash,
      block: log.blockNumber,
      user: log.args.user as `0x${string}`,
      inviter: log.args.inviter as `0x${string}`,
      appReward: log.args.appReward as bigint,
      userAmount: log.args.userAmount as bigint,
      inviterAmount: log.args.inviterAmount as bigint,
    }));
  }

  async getAppHistory(app: Address): Promise<AppEvent[]> {
    const curBlock = await this.publicClient.getBlockNumber();
    const events = await this.publicClient.getContractEvents({
      address: this.contractAddress,
      abi: engagementRewardsABI,
      eventName: "AppApplied",
      args: { app },
      fromBlock: curBlock - BigInt(BLOCKS_AGO),
    });

    return events.map((log) => ({
      owner: log.args.owner as Address,
      rewardReceiver: log.args.rewardReceiver as Address,
      userAndInviterPercentage: Number(log.args.userAndInviterPercentage),
      userPercentage: Number(log.args.userPercentage),
      description: log.args.description as string,
      url: log.args.url as string,
      email: log.args.email as string,
      block: log.blockNumber,
    }));
  }

  async getCurrentBlockNumber() {
    return this.publicClient.getBlockNumber();
  }

  async canClaim(app: Address, user: Address) {
    try {
      await this.publicClient.readContract({
        address: this.contractAddress,
        abi: engagementRewardsABI,
        functionName: "canClaim",
        args: [app, user],
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

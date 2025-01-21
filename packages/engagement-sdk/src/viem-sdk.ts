import { Address, PublicClient, WalletClient, parseAbi } from "viem";
import { waitForTransactionReceipt } from "viem/actions";

const engagementRewardsABI = parseAbi([
  "function applyApp(address app, address rewardReceiver, uint256 userInviterPercentage, uint256 userPercentage) external",
  "function approve(address app) external",
  "function claim(address inviter) external returns (bool)",
  "function claimWithSignature(address app, address inviter, uint256 nonce, bytes memory signature) external returns (bool)",
  "function updateAppSettings(address app, address rewardReceiver, uint256 userInviterPercentage, uint256 userPercentage) external",
  "function registeredApps(address) external view returns (bool isRegistered, bool isApproved, address owner, address rewardReceiver, uint256 registeredAt, uint256 lastResetAt, uint256 totalRewardsClaimed, uint256 userInviterPercentage, uint256 userPercentage)",
]);

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

  async applyApp(
    app: Address,
    rewardReceiver: Address,
    userInviterPercentage: number,
    userPercentage: number,
  ) {
    const [account] = await this.walletClient.getAddresses();
    const { request } = await this.publicClient.simulateContract({
      account,
      address: this.contractAddress,
      abi: engagementRewardsABI,
      functionName: "applyApp",
      args: [
        app,
        rewardReceiver,
        BigInt(userInviterPercentage),
        BigInt(userPercentage),
      ],
    });
    return waitForTransactionReceipt(this.publicClient, {
      hash: await this.walletClient.writeContract(request),
    });
  }

  async approve(app: Address) {
    const [account] = await this.walletClient.getAddresses();
    const { request } = await this.publicClient.simulateContract({
      account,
      address: this.contractAddress,
      abi: engagementRewardsABI,
      functionName: "approve",
      args: [app],
    });
    return waitForTransactionReceipt(this.publicClient, {
      hash: await this.walletClient.writeContract(request),
    });
  }

  async claim(inviter: Address) {
    const [account] = await this.walletClient.getAddresses();
    const { request } = await this.publicClient.simulateContract({
      account,
      address: this.contractAddress,
      abi: engagementRewardsABI,
      functionName: "claim",
      args: [inviter],
    });
    return waitForTransactionReceipt(this.publicClient, {
      hash: await this.walletClient.writeContract(request),
    });
  }

  async claimWithSignature(
    app: Address,
    inviter: Address,
    nonce: bigint,
    signature: `0x${string}`,
  ) {
    const [account] = await this.walletClient.getAddresses();
    const { request } = await this.publicClient.simulateContract({
      account,
      address: this.contractAddress,
      abi: engagementRewardsABI,
      functionName: "claimWithSignature",
      args: [app, inviter, nonce, signature],
    });
    return waitForTransactionReceipt(this.publicClient, {
      hash: await this.walletClient.writeContract(request),
    });
  }

  async updateAppSettings(
    app: Address,
    rewardReceiver: Address,
    userInviterPercentage: number,
    userPercentage: number,
  ) {
    const [account] = await this.walletClient.getAddresses();
    const { request } = await this.publicClient.simulateContract({
      account,
      address: this.contractAddress,
      abi: engagementRewardsABI,
      functionName: "updateAppSettings",
      args: [
        app,
        rewardReceiver,
        BigInt(userInviterPercentage),
        BigInt(userPercentage),
      ],
    });
    return waitForTransactionReceipt(this.publicClient, {
      hash: await this.walletClient.writeContract(request),
    });
  }

  async getAppInfo(app: Address) {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: engagementRewardsABI,
      functionName: "registeredApps",
      args: [app],
    });
  }
}

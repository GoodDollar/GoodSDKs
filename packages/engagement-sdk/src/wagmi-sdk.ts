import { usePublicClient, useWalletClient } from "wagmi";
import { EngagementRewardsSDK } from "./viem-sdk";
import { Address } from "viem";

export function useEngagementRewards(contractAddress: Address) {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  if (!walletClient || !publicClient) {
    console.error("Wallet client is not available");
    return;
  }

  const sdk = new EngagementRewardsSDK(
    publicClient,
    walletClient,
    contractAddress,
  );

  return {
    applyApp: sdk.applyApp.bind(sdk),
    approve: sdk.approve.bind(sdk),
    claim: sdk.claim.bind(sdk),
    claimWithSignature: sdk.claimWithSignature.bind(sdk),
    updateAppSettings: sdk.updateAppSettings.bind(sdk),
    getAppInfo: sdk.getAppInfo.bind(sdk),
  };
}

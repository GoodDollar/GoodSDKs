import { usePublicClient, useWalletClient } from "wagmi";
import { EngagementRewardsSDK } from "./viem-sdk";
import { Address } from "viem";

export function useEngagementRewards(contractAddress: Address) {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  if (!walletClient || !publicClient) {
    return;
  }

  const sdk = new EngagementRewardsSDK(
    publicClient,
    walletClient,
    contractAddress,
  );

  return sdk;
}

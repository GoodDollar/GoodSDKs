import { usePublicClient, useWalletClient } from "wagmi"
import {
  EngagementRewardsSDK,
  type EngagementRewardsSDKOptions,
} from "./viem-sdk"
import { Address } from "viem"

export function useEngagementRewards(
  contractAddress: Address,
  options?: EngagementRewardsSDKOptions & { debug?: boolean },
) {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  if (!walletClient || !publicClient) {
    return
  }

  const sdk = new EngagementRewardsSDK(
    publicClient,
    walletClient,
    contractAddress,
    options,
  )

  return sdk
}

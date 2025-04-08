import { usePublicClient, useWalletClient } from "wagmi"
import { PublicClient } from "viem"

import { ClaimSDK } from "./viem-claim-sdk"
import { useIdentitySDK } from "./wagmi-identity-sdk"
import { contractEnv } from "../constants"

/**
 * Hook to initialize and provide the ClaimSDK instance.
 *
 * @param env - The environment to use ("production" | "staging" | "development").
 * @returns An instance of ClaimSDK or null if prerequisites are not met.
 */
export const useClaimSDK = (
  env: contractEnv = "production",
): (() => Promise<ClaimSDK>) | null => {
  const publicClient = usePublicClient() as PublicClient
  const { data: walletClient } = useWalletClient()
  const identitySDK = useIdentitySDK(env)

  if (!publicClient || !walletClient || !identitySDK) {
    return null
  }

  const initialize = async () => {
    const sdk = await ClaimSDK.init({
      publicClient,
      walletClient,
      identitySDK,
      env,
    })
    return sdk
  }

  return initialize
}

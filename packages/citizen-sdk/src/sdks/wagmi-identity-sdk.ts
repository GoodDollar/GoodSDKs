import { usePublicClient, useWalletClient } from "wagmi"
import { PublicClient } from "viem"

import { IdentitySDK } from "./viem-identity-sdk"

import { contractEnv } from "../constants"

export const useIdentitySDK = (
  env: contractEnv = "production",
): IdentitySDK | null => {
  const publicClient = usePublicClient() as PublicClient
  const { data: walletClient } = useWalletClient()

  if (!publicClient || !walletClient) {
    return null
  }

  const sdk = new IdentitySDK(publicClient, walletClient, env)

  return sdk
}

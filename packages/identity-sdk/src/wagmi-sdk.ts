import { useMemo } from "react"
import { usePublicClient, useWalletClient } from "wagmi"
import { PublicClient } from "viem"

import { IdentitySDK } from "./viem-sdk"

import { contractEnv } from "./constants"

export const useIdentitySDK = (
  env: contractEnv = "production",
): IdentitySDK | null => {
  const publicClient = usePublicClient() as PublicClient
  const { data: walletClient } = useWalletClient()

  const sdk = useMemo(() => {
    if (!publicClient || !walletClient) {
      return null
    }

    return new IdentitySDK(publicClient, walletClient, env)
  }, [publicClient, walletClient, env])

  return sdk
}

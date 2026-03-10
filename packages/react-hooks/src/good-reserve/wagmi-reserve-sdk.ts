import { useMemo } from "react"
import { usePublicClient, useWalletClient } from "wagmi"
import { type PublicClient } from "viem"
import { GoodReserveSDK, type ReserveEnv, type GoodReserveSDKOptions } from "@goodsdks/good-reserve"

export function useGoodReserve(env: ReserveEnv = "production", options?: GoodReserveSDKOptions) {
  const publicClient = usePublicClient() as PublicClient | undefined
  const { data: walletClient } = useWalletClient()

  const exactApproval = options?.exactApproval

  return useMemo(() => {
    if (!publicClient) {
      return { sdk: null, loading: false, error: "Public client not initialized" }
    }

    try {
      const sdk = new GoodReserveSDK(publicClient, walletClient ?? undefined, env, { exactApproval })
      return { sdk, loading: false, error: null }
    } catch (err) {
      return { 
        sdk: null, 
        loading: false, 
        error: err instanceof Error ? err.message : String(err) 
      }
    }
  }, [publicClient, walletClient, env, exactApproval])
}

import { useState, useEffect } from "react"
import { usePublicClient, useWalletClient } from "wagmi"
import { PublicClient } from "viem"
import { contractEnv, ClaimSDK } from "@goodsdks/citizen-sdk"
import { useIdentitySDK } from "./wagmi-identity-sdk"

export const useClaimSDK = (
  env: contractEnv = "production",
): {
  sdk: ClaimSDK | null
  loading: boolean
  error: string | null
} => {
  const publicClient = usePublicClient() as PublicClient
  const { data: walletClient } = useWalletClient()
  const { sdk: identitySDK, error: identityError } = useIdentitySDK(env)

  const [sdk, setSDK] = useState<ClaimSDK | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    if (!publicClient || !walletClient || !identitySDK) {
      setSDK(null)
      setError(identityError ?? "Public or Wallet client not initialized")
      return
    }

    setError(null)
    setLoading(true)

    ClaimSDK.init({
      publicClient,
      walletClient,
      identitySDK,
      env,
    })
      .then(setSDK)
      .catch((err: any) => {
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [publicClient, walletClient, identitySDK, env, identityError])

  return { sdk, loading, error }
}

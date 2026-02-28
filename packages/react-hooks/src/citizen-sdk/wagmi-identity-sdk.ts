import { useState, useEffect } from "react"
import { usePublicClient, useWalletClient } from "wagmi"
import { PublicClient } from "viem"

import { contractEnv, IdentitySDK } from "@goodsdks/citizen-sdk"

export const useIdentitySDK = (
  env: contractEnv = "production",
): {
  sdk: IdentitySDK | null
  loading: boolean
  error: string | null
} => {
  const publicClient = usePublicClient() as PublicClient
  const { data: walletClient } = useWalletClient()

  const [sdk, setSdk] = useState<IdentitySDK | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!publicClient || !walletClient) {
      setSdk(null)
      setError("Wallet or Public client not initialized")
      return
    }

    setLoading(true)
    IdentitySDK.init({ publicClient, walletClient, env })
      .then((instance) => {
        setSdk(instance)
        setError(null)
      })
      .catch((err) => {
        setSdk(null)
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => setLoading(false))
  }, [publicClient, walletClient, env])

  return { sdk, loading, error }
}

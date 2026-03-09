import { useState, useEffect } from "react"
import { usePublicClient, useWalletClient } from "wagmi"
import { type PublicClient } from "viem"
import { GoodReserveSDK, type ReserveEnv } from "@goodsdks/good-reserve"

export function useGoodReserve(env: ReserveEnv = "production") {
  const publicClient = usePublicClient() as PublicClient
  const { data: walletClient } = useWalletClient()

  const [sdk, setSdk] = useState<GoodReserveSDK | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!publicClient) {
      setSdk(null)
      setError("Public client not initialized")
      return
    }

    setLoading(true)
    setError(null)

    try {
      setSdk(new GoodReserveSDK(publicClient, walletClient ?? undefined, env))
    } catch (err) {
      setSdk(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [publicClient, walletClient, env])

  return { sdk, loading, error }
}

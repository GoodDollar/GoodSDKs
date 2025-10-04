import { useState, useEffect } from "react"
import { usePublicClient, useWalletClient } from "wagmi";
import { PublicClient } from "viem"
import { GooddollarSavingsSDK } from "./viem-sdk";

export function useGooddollarSavings() {
  const publicClient = usePublicClient() as PublicClient
  const { data: walletClient } = useWalletClient();

  const [sdk, setSDK] = useState<GooddollarSavingsSDK | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  if (!walletClient || !publicClient) {
    return;
  }

  useEffect(() => {
    if (!publicClient || !walletClient) {
      setSDK(null)
      setError("Public or Wallet client not initialized")
      return
    }

    setError(null)
    setLoading(true)

    try {
      const sdk = new GooddollarSavingsSDK(
        publicClient,
        walletClient,
      );
      setSDK(sdk)
    } catch (err: any) {
      setError(err instanceof Error ? err.message : String(err))
      setSDK(null)
    } finally {
      setLoading(false)
    }


  }, [publicClient, walletClient])

  return { sdk, loading, error }
}

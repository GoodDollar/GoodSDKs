import { useEffect, useState } from "react"
import { usePublicClient, useWalletClient } from "wagmi"
import { useChainId } from "wagmi"
import { BridgingSDK } from "./viem-sdk"
import type { BridgeProtocol, ChainId } from "./types"

export interface UseBridgingSDKResult {
  sdk: BridgingSDK | null
  loading: boolean
  error: string | null
}

/**
 * Wagmi hook for using the BridgingSDK
 *
 * @example
 * ```tsx
 * import { useBridgingSDK } from "@goodsdks/bridging-sdk"
 *
 * const BridgeComponent = () => {
 *   const { sdk, loading, error } = useBridgingSDK()
 *
 *   if (loading) return <p>Loading...</p>
 *   if (error) return <p>Error: {error}</p>
 *   if (!sdk) return <p>SDK not initialized</p>
 *
 *   // Use sdk methods here
 *   return <div>Ready to bridge!</div>
 * }
 * ```
 */
export function useBridgingSDK(): UseBridgingSDKResult {
  const [sdk, setSdk] = useState<BridgingSDK | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const chainId = useChainId() as ChainId

  useEffect(() => {
    try {
      setLoading(true)
      setError(null)

      if (!publicClient) {
        setError("Public client not available")
        setSdk(null)
        return
      }

      const bridgingSDK = new BridgingSDK(
        publicClient as any,
        (walletClient as any) || undefined,
        chainId,
      )
      setSdk(bridgingSDK)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize SDK")
      setSdk(null)
    } finally {
      setLoading(false)
    }
  }, [publicClient, walletClient, chainId])

  return { sdk, loading, error }
}

/**
 * Hook for getting fee estimates for bridging
 */
export function useBridgeFee(
  fromChainId: ChainId,
  toChainId: ChainId,
  protocol: BridgeProtocol,
) {
  const [fee, setFee] = useState<{ amount: bigint; formatted: string } | null>(
    null,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchFee = async () => {
      if (!fromChainId || !toChainId || !protocol) return

      try {
        setLoading(true)
        setError(null)

        // Import dynamically to avoid SSR issues
        const { getFeeEstimate } = await import("./utils/fees")
        const feeEstimate = await getFeeEstimate(
          fromChainId,
          toChainId,
          protocol,
        )

        setFee({
          amount: feeEstimate.fee,
          formatted: feeEstimate.feeInNative,
        })
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch fee estimate",
        )
      } finally {
        setLoading(false)
      }
    }

    fetchFee()
  }, [fromChainId, toChainId, protocol])

  return { fee, loading, error }
}

/**
 * Hook for tracking bridge transaction status
 */
export function useBridgeTransactionStatus(
  txHash: string | undefined,
  protocol: BridgeProtocol | undefined,
) {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!txHash || !protocol) return

    const trackStatus = async () => {
      try {
        setLoading(true)
        setError(null)

        // Import dynamically to avoid SSR issues
        const { getTransactionStatus } = await import("./utils/tracking")
        const txStatus = await getTransactionStatus(txHash as any, protocol)

        setStatus(txStatus)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch transaction status",
        )
      } finally {
        setLoading(false)
      }
    }

    trackStatus()
  }, [txHash, protocol])

  return { status, loading, error }
}

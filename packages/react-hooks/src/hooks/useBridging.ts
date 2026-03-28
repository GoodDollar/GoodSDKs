import { useEffect, useState, useMemo } from "react"
import { usePublicClient, useWalletClient, useChainId } from "wagmi"
import { type PublicClient } from "viem"
import { BridgingSDK, type BridgeProtocol, type ChainId, type BridgeRequestEvent, type ExecutedTransferEvent } from "@goodsdks/bridging-sdk"

export interface UseBridgingSDKResult {
  sdk: BridgingSDK | null
  loading: boolean
  error: string | null
}

/**
 * Wagmi hook for using the BridgingSDK
 */
export function useBridgingSDK(): UseBridgingSDKResult {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const chainId = useChainId() as ChainId

  const [sdk, setSdk] = useState<BridgingSDK | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Prevent re-initialization if we already have an SDK for this chain
    if (sdk && sdk.getCurrentChainId() === chainId) {
      // Just update the wallet client if it changed
      if (walletClient) {
        try {
          sdk.setWalletClient(walletClient as any);
        } catch (e) {
          console.error("Failed to update wallet client", e);
        }
      }
      return;
    }

    const initSDK = async () => {
      try {
        setLoading(true)
        setError(null)

        if (!publicClient) {
          setError("Public client not available")
          return
        }

        const bridgingSDK = new BridgingSDK(
          publicClient as any,
          (walletClient as any) || undefined,
          chainId,
        )
        
        // Fetch fees upon initialization
        await bridgingSDK.initialize()
        
        setSdk(bridgingSDK)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize SDK")
      } finally {
        setLoading(false)
      }
    }

    initSDK()
  }, [chainId, publicClient, walletClient]) // Re-added walletClient so the early-return block can attach it

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
  const { sdk } = useBridgingSDK()
  const [fee, setFee] = useState<{ amount: bigint; formatted: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchFee = async () => {
      if (!sdk || !fromChainId || !toChainId || !protocol) return

      try {
        setLoading(true)
        setError(null)

        const feeEstimate = await sdk.estimateFee(toChainId, protocol, fromChainId)

        setFee({
          amount: feeEstimate.fee,
          formatted: feeEstimate.feeInNative,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch fee estimate")
      } finally {
        setLoading(false)
      }
    }

    fetchFee()
  }, [sdk, fromChainId, toChainId, protocol])

  return { fee, loading, error }
}

/**
 * Hook for fetching and tracking bridge history
 */
export function useBridgeHistory(
  address: `0x${string}` | undefined,
  clients?: Record<number, PublicClient>
) {
  const { sdk } = useBridgingSDK()
  const [history, setHistory] = useState<(BridgeRequestEvent | ExecutedTransferEvent)[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = async () => {
    if (!sdk || !address) return

    try {
      setLoading(true)
      setError(null)
      
      const data = clients 
        ? await BridgingSDK.getAllHistory(address, clients)
        : await sdk.getHistory(address)
        
      setHistory(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch history")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
    const interval = setInterval(fetchHistory, 30000) // Poll every 30s
    return () => clearInterval(interval)
  }, [sdk, address, clients])

  return { history, loading, error, refetch: fetchHistory }
}

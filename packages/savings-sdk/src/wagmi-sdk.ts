import { useEffect, useMemo, useState } from "react"
import { useChainId, usePublicClient, useWalletClient } from "wagmi"
import { PublicClient } from "viem"

import { GooddollarSavingsSDK } from "./viem-sdk"
import {
  GooddollarSavingsSDKOptions,
} from "./viem-sdk"
import {
  SUPPORTED_CHAIN_IDS,
  SupportedChainId,
  formatSupportedNetworkList,
  isSupportedChainId,
} from "./constants"

export interface UseGooddollarSavingsResult {
  sdk: GooddollarSavingsSDK | null
  loading: boolean
  error: string | null
  /** True when wallet is connected to a chain other than Celo / XDC. */
  isWrongNetwork: boolean
  /** Active chain id from wagmi (may be unsupported). */
  chainId: number | undefined
  /** Chains the savings flow accepts. */
  supportedChainIds: readonly SupportedChainId[]
}

export function useGooddollarSavings(
  options: GooddollarSavingsSDKOptions = {},
): UseGooddollarSavingsResult {
  const chainId = useChainId()
  const publicClient = usePublicClient({ chainId }) as PublicClient | undefined
  const { data: walletClient } = useWalletClient({ chainId })

  const [sdk, setSDK] = useState<GooddollarSavingsSDK | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  const isWrongNetwork = useMemo(
    () => chainId !== undefined && !isSupportedChainId(chainId),
    [chainId],
  )

  // Re-initialise the SDK when clients or chain change. Memoise the override
  // map so identical option objects don't trigger spurious effects.
  const contractsKey = useMemo(
    () => JSON.stringify(options.contracts ?? {}),
    [options.contracts],
  )

  useEffect(() => {
    if (!publicClient) {
      setSDK(null)
      setError(null)
      return
    }

    if (isWrongNetwork) {
      setSDK(null)
      setError(
        `Wrong network. Please switch to ${formatSupportedNetworkList()}.`,
      )
      return
    }

    setError(null)
    setLoading(true)

    try {
      const next = new GooddollarSavingsSDK(
        publicClient,
        walletClient ?? undefined,
        { contracts: options.contracts },
      )
      setSDK(next)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      setSDK(null)
    } finally {
      setLoading(false)
    }
    // contractsKey captures override changes, options.contracts itself can be
    // a fresh object on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient, walletClient, isWrongNetwork, contractsKey])

  return {
    sdk,
    loading,
    error,
    isWrongNetwork,
    chainId,
    supportedChainIds: SUPPORTED_CHAIN_IDS,
  }
}

import { useState, useEffect, useCallback } from "react"
import { usePublicClient, useWalletClient } from "wagmi"
import { PublicClient, Address } from "viem"

import { contractEnv, IdentitySDK } from "@goodsdks/citizen-sdk"
import type {
  WalletLinkOptions,
  ConnectedAccountStatus,
  ChainConnectedStatus,
} from "@goodsdks/citizen-sdk"

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

// ─── Wallet Link Hooks ────────────────────────────────────────────────────────

export interface UseConnectAccountReturn {
  /**
   * Call to connect a secondary wallet to the root identity.
   * If `skipSecurityMessage` is not set the hook will surface a security
   * confirmation via `pendingSecurityConfirm` for the UI to render.
   */
  connect: (account: Address, options?: WalletLinkOptions) => Promise<void>
  loading: boolean
  error: string | null
  txHash: `0x${string}` | null
  /**
   * Non-null when the SDK is waiting for user confirmation of the security
   * notice. The UI should display `pendingSecurityConfirm.message` and call
   * `confirmSecurity(true | false)` to proceed or cancel.
   */
  pendingSecurityConfirm: { message: string } | null
  confirmSecurity: (confirmed: boolean) => void
  reset: () => void
}

export const useConnectAccount = (
  sdk: IdentitySDK | null,
): UseConnectAccountReturn => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const [pendingSecurityConfirm, setPendingSecurityConfirm] = useState<{
    message: string
    resolve: (confirmed: boolean) => void
  } | null>(null)

  const reset = useCallback(() => {
    setError(null)
    setTxHash(null)
    setPendingSecurityConfirm(null)
  }, [])

  const confirmSecurity = useCallback(
    (confirmed: boolean) => {
      pendingSecurityConfirm?.resolve(confirmed)
      setPendingSecurityConfirm(null)
    },
    [pendingSecurityConfirm],
  )

  const connect = useCallback(
    async (account: Address, options?: WalletLinkOptions) => {
      if (!sdk) {
        setError("IdentitySDK not initialized")
        return
      }

      setLoading(true)
      setError(null)
      setTxHash(null)

      try {
        await sdk.connectAccount(account, {
          ...options,
          onHash: (hash) => {
            setTxHash(hash)
            options?.onHash?.(hash)
          },
          // Only inject the confirmation dialog when the caller hasn't
          // already provided their own callback and hasn't opted out.
          onSecurityMessage:
            options?.onSecurityMessage ??
            (options?.skipSecurityMessage
              ? undefined
              : (message) =>
                  new Promise((resolve) => {
                    setPendingSecurityConfirm({ message, resolve })
                  })),
        })
      } catch (err: any) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    },
    [sdk],
  )

  return {
    connect,
    loading,
    error,
    txHash,
    pendingSecurityConfirm: pendingSecurityConfirm
      ? { message: pendingSecurityConfirm.message }
      : null,
    confirmSecurity,
    reset,
  }
}

export interface UseDisconnectAccountReturn {
  disconnect: (account: Address, options?: WalletLinkOptions) => Promise<void>
  loading: boolean
  error: string | null
  txHash: `0x${string}` | null
  pendingSecurityConfirm: { message: string } | null
  confirmSecurity: (confirmed: boolean) => void
  reset: () => void
}

export const useDisconnectAccount = (
  sdk: IdentitySDK | null,
): UseDisconnectAccountReturn => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const [pendingSecurityConfirm, setPendingSecurityConfirm] = useState<{
    message: string
    resolve: (confirmed: boolean) => void
  } | null>(null)

  const reset = useCallback(() => {
    setError(null)
    setTxHash(null)
    setPendingSecurityConfirm(null)
  }, [])

  const confirmSecurity = useCallback(
    (confirmed: boolean) => {
      pendingSecurityConfirm?.resolve(confirmed)
      setPendingSecurityConfirm(null)
    },
    [pendingSecurityConfirm],
  )

  const disconnect = useCallback(
    async (account: Address, options?: WalletLinkOptions) => {
      if (!sdk) {
        setError("IdentitySDK not initialized")
        return
      }

      setLoading(true)
      setError(null)
      setTxHash(null)

      try {
        await sdk.disconnectAccount(account, {
          ...options,
          onHash: (hash) => {
            setTxHash(hash)
            options?.onHash?.(hash)
          },
          onSecurityMessage:
            options?.onSecurityMessage ??
            (options?.skipSecurityMessage
              ? undefined
              : (message) =>
                  new Promise((resolve) => {
                    setPendingSecurityConfirm({ message, resolve })
                  })),
        })
      } catch (err: any) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    },
    [sdk],
  )

  return {
    disconnect,
    loading,
    error,
    txHash,
    pendingSecurityConfirm: pendingSecurityConfirm
      ? { message: pendingSecurityConfirm.message }
      : null,
    confirmSecurity,
    reset,
  }
}

export interface UseConnectedStatusReturn {
  /** Per-current-chain status */
  status: ConnectedAccountStatus | null
  /** Status across all supported chains */
  allChainStatuses: ChainConnectedStatus[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export const useConnectedStatus = (
  sdk: IdentitySDK | null,
  account: Address | undefined,
): UseConnectedStatusReturn => {
  const [status, setStatus] = useState<ConnectedAccountStatus | null>(null)
  const [allChainStatuses, setAllChainStatuses] = useState<ChainConnectedStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trigger, setTrigger] = useState(0)

  const refetch = useCallback(() => setTrigger((n) => n + 1), [])

  useEffect(() => {
    if (!sdk || !account) {
      setStatus(null)
      setAllChainStatuses([])
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      sdk.getConnectedAccounts(account),
      sdk.checkConnectedStatusAllChains(account),
    ])
      .then(([singleChain, allChains]) => {
        if (cancelled) return
        setStatus(singleChain)
        setAllChainStatuses(allChains)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sdk, account, trigger])

  return { status, allChainStatuses, loading, error, refetch }
}

export interface UseWalletLinkReturn {
  sdk: IdentitySDK | null
  sdkLoading: boolean
  sdkError: string | null
  connectAccount: UseConnectAccountReturn
  disconnectAccount: UseDisconnectAccountReturn
  connectedStatus: UseConnectedStatusReturn
}

/**
 * All-in-one hook that initialises the IdentitySDK and exposes connect,
 * disconnect and status sub-hooks.
 *
 * @param env - Contract environment ("production" | "staging" | "development").
 * @param watchAccount - Address to monitor connection status for.
 */
export const useWalletLink = (
  env: contractEnv = "production",
  watchAccount?: Address,
): UseWalletLinkReturn => {
  const publicClient = usePublicClient() as PublicClient
  const { data: walletClient } = useWalletClient()

  const [sdk, setSdk] = useState<IdentitySDK | null>(null)
  const [sdkError, setSdkError] = useState<string | null>(null)
  const [sdkLoading, setSdkLoading] = useState(false)

  useEffect(() => {
    if (!publicClient || !walletClient) {
      setSdk(null)
      setSdkError("Wallet or Public client not initialized")
      return
    }

    setSdkLoading(true)
    IdentitySDK.init({ publicClient, walletClient, env })
      .then((instance) => {
        setSdk(instance)
        setSdkError(null)
      })
      .catch((err) => {
        setSdk(null)
        setSdkError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => setSdkLoading(false))
  }, [publicClient, walletClient, env])

  const connectAccount = useConnectAccount(sdk)
  const disconnectAccount = useDisconnectAccount(sdk)
  const connectedStatus = useConnectedStatus(sdk, watchAccount)

  return { sdk, sdkLoading, sdkError, connectAccount, disconnectAccount, connectedStatus }
}
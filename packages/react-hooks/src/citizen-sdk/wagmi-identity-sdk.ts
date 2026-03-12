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



type WalletLinkAction = (sdk: IdentitySDK, account: Address, options?: WalletLinkOptions) => Promise<void>

interface UseWalletLinkActionReturn {
  run: (account: Address, options?: WalletLinkOptions) => Promise<void>
  loading: boolean
  error: string | null
  txHash: `0x${string}` | null
  pendingSecurityConfirm: { message: string; resolve: (confirmed: boolean) => void } | null
  confirmSecurity: (confirmed: boolean) => void
  reset: () => void
}

const useWalletLinkAction = (
  sdk: IdentitySDK | null,
  action: WalletLinkAction,
): UseWalletLinkActionReturn => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const [pendingSecurityConfirm, setPendingSecurityConfirm] = useState<{
    message: string
    resolve: (confirmed: boolean) => void
  } | null>(null)

  const reset = useCallback(() => {
    setLoading(false)
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

  const run = useCallback(
    async (account: Address, options?: WalletLinkOptions) => {
      if (!sdk) {
        setError("IdentitySDK not initialized")
        return
      }

      setLoading(true)
      setError(null)
      setTxHash(null)

      try {
        await action(sdk, account, {
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
    [sdk, action],
  )

  return {
    run,
    loading,
    error,
    txHash,
    pendingSecurityConfirm,
    confirmSecurity,
    reset,
  }
}


export interface UseConnectAccountReturn extends Omit<UseWalletLinkActionReturn, "run" | "pendingSecurityConfirm"> {
  connect: UseWalletLinkActionReturn["run"]
  pendingSecurityConfirm: { message: string } | null
}

export const useConnectAccount = (sdk: IdentitySDK | null): UseConnectAccountReturn => {
  const base = useWalletLinkAction(sdk, (s, account, options) =>
    s.connectAccount(account, options),
  )
  return { 
    ...base, 
    connect: base.run,
    pendingSecurityConfirm: base.pendingSecurityConfirm ? { message: base.pendingSecurityConfirm.message } : null
  }
}

export interface UseDisconnectAccountReturn extends Omit<UseWalletLinkActionReturn, "run" | "pendingSecurityConfirm"> {
  disconnect: UseWalletLinkActionReturn["run"]
  pendingSecurityConfirm: { message: string } | null
}

export const useDisconnectAccount = (sdk: IdentitySDK | null): UseDisconnectAccountReturn => {
  const base = useWalletLinkAction(sdk, (s, account, options) =>
    s.disconnectAccount(account, options),
  )
  return { 
    ...base, 
    disconnect: base.run,
    pendingSecurityConfirm: base.pendingSecurityConfirm ? { message: base.pendingSecurityConfirm.message } : null 
  }
}

export interface UseConnectedStatusReturn {
  status: ConnectedAccountStatus | null
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

export const useWalletLink = (
  env: contractEnv = "production",
  watchAccount?: Address,
): UseWalletLinkReturn => {
  const { sdk, loading, error } = useIdentitySDK(env)
  
  const connectAccount = useConnectAccount(sdk)
  const disconnectAccount = useDisconnectAccount(sdk)
  const connectedStatus = useConnectedStatus(sdk, watchAccount)

  return { sdk, sdkLoading: loading, sdkError: error, connectAccount, disconnectAccount, connectedStatus }
}
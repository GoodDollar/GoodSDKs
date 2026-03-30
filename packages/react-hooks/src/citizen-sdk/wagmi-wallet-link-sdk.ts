import { useState, useEffect, useCallback } from "react"
import { Address, PublicClient } from "viem"

import { contractEnv, IdentitySDK, SupportedChains } from "@goodsdks/citizen-sdk"
import type { WalletLinkOptions, ChainConnectedStatus } from "@goodsdks/citizen-sdk"

import { useIdentitySDK } from "./wagmi-identity-sdk"

type WalletLinkAction = (
    sdk: IdentitySDK,
    account: Address,
    options?: WalletLinkOptions,
) => Promise<void>

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

export interface UseConnectAccountReturn
    extends Omit<UseWalletLinkActionReturn, "run" | "pendingSecurityConfirm"> {
    connect: UseWalletLinkActionReturn["run"]
    pendingSecurityConfirm: { message: string } | null
}

export const useConnectAccount = (
    sdk: IdentitySDK | null,
): UseConnectAccountReturn => {
    const base = useWalletLinkAction(sdk, (s, account, options) =>
        s.connectAccount(account, options),
    )
    return {
        ...base,
        connect: base.run,
        pendingSecurityConfirm: base.pendingSecurityConfirm
            ? { message: base.pendingSecurityConfirm.message }
            : null,
    }
}

export interface UseDisconnectAccountReturn
    extends Omit<UseWalletLinkActionReturn, "run" | "pendingSecurityConfirm"> {
    disconnect: UseWalletLinkActionReturn["run"]
    pendingSecurityConfirm: { message: string } | null
}

export const useDisconnectAccount = (
    sdk: IdentitySDK | null,
): UseDisconnectAccountReturn => {
    const base = useWalletLinkAction(sdk, (s, account, options) =>
        s.disconnectAccount(account, options),
    )
    return {
        ...base,
        disconnect: base.run,
        pendingSecurityConfirm: base.pendingSecurityConfirm
            ? { message: base.pendingSecurityConfirm.message }
            : null,
    }
}

export interface UseConnectedStatusReturn {
    statuses: ChainConnectedStatus[]
    loading: boolean
    error: string | null
    refetch: () => void
}

export const useConnectedStatus = (
    sdk: IdentitySDK | null,
    account: Address | undefined,
    chainId?: SupportedChains,
    publicClients?: Record<SupportedChains, PublicClient>,
): UseConnectedStatusReturn => {
    const [statuses, setStatuses] = useState<ChainConnectedStatus[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [trigger, setTrigger] = useState(0)

    const refetch = useCallback(() => setTrigger((n) => n + 1), [])

    useEffect(() => {
        if (!sdk || !account) {
            setStatuses([])
            return
        }

        let cancelled = false
        setLoading(true)
        setError(null)

        sdk
            .checkConnectedStatus(account, chainId, publicClients)
            .then((result) => {
                if (cancelled) return
                setStatuses(result)
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
    }, [sdk, account, chainId, trigger])

    return { statuses, loading, error, refetch }
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
    chainId?: SupportedChains,
    publicClients?: Record<SupportedChains, PublicClient>,
): UseWalletLinkReturn => {
    const { sdk, loading, error } = useIdentitySDK(env)

    const connectAccount = useConnectAccount(sdk)
    const disconnectAccount = useDisconnectAccount(sdk)
    const connectedStatus = useConnectedStatus(sdk, watchAccount, chainId, publicClients)

    return {
        sdk,
        sdkLoading: loading,
        sdkError: error,
        connectAccount,
        disconnectAccount,
        connectedStatus,
    }
}
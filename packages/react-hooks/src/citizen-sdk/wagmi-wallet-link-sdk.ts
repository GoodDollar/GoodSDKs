import { useState, useEffect, useCallback, useRef } from "react"
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
    pendingSecurityConfirm: { message: string } | null
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
    const [pendingSecurityMessage, setPendingSecurityMessage] = useState<string | null>(null)
    const securityResolveRef = useRef<((confirmed: boolean) => void) | null>(null)

    const reset = useCallback(() => {
        setLoading(false)
        setError(null)
        setTxHash(null)
        securityResolveRef.current = null
        setPendingSecurityMessage(null)
    }, [])

    const confirmSecurity = useCallback((confirmed: boolean) => {
        securityResolveRef.current?.(confirmed)
        securityResolveRef.current = null
        setPendingSecurityMessage(null)
    }, [])

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
                                new Promise<boolean>((resolve) => {
                                    securityResolveRef.current = resolve
                                    setPendingSecurityMessage(message)
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
        pendingSecurityConfirm: pendingSecurityMessage
            ? { message: pendingSecurityMessage }
            : null,
        confirmSecurity,
        reset,
    }
}

export interface UseWalletLinkActionsReturn
    extends Omit<UseWalletLinkActionReturn, "run" | "pendingSecurityConfirm"> {
    connect: UseWalletLinkActionReturn["run"]
    disconnect: UseWalletLinkActionReturn["run"]
    pendingSecurityConfirm: { message: string } | null
}

export const useWalletLinkActions = (
    sdk: IdentitySDK | null,
): UseWalletLinkActionsReturn => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
    const [pendingSecurityMessage, setPendingSecurityMessage] = useState<string | null>(null)
    const securityResolveRef = useRef<((confirmed: boolean) => void) | null>(null)

    const reset = useCallback(() => {
        setLoading(false)
        setError(null)
        setTxHash(null)
        securityResolveRef.current = null
        setPendingSecurityMessage(null)
    }, [])

    const confirmSecurity = useCallback((confirmed: boolean) => {
        securityResolveRef.current?.(confirmed)
        securityResolveRef.current = null
        setPendingSecurityMessage(null)
    }, [])

    const run = useCallback(
        async (
            action: "connect" | "disconnect",
            account: Address,
            options?: WalletLinkOptions,
        ) => {
            if (!sdk) {
                setError("IdentitySDK not initialized")
                return
            }

            setLoading(true)
            setError(null)
            setTxHash(null)

            const actionFn =
                action === "connect"
                    ? sdk.connectAccount.bind(sdk)
                    : sdk.disconnectAccount.bind(sdk)

            try {
                await actionFn(account, {
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
                                new Promise<boolean>((resolve) => {
                                    securityResolveRef.current = resolve
                                    setPendingSecurityMessage(message)
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

    const connect = useCallback(
        (account: Address, options?: WalletLinkOptions) =>
            run("connect", account, options),
        [run],
    )

    const disconnect = useCallback(
        (account: Address, options?: WalletLinkOptions) =>
            run("disconnect", account, options),
        [run],
    )

    return {
        connect,
        disconnect,
        loading,
        error,
        txHash,
        pendingSecurityConfirm: pendingSecurityMessage
            ? { message: pendingSecurityMessage }
            : null,
        confirmSecurity,
        reset,
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
    }, [sdk, account, chainId, publicClients, trigger])

    return { statuses, loading, error, refetch }
}

export interface UseWalletLinkReturn {
    sdk: IdentitySDK | null
    sdkLoading: boolean
    sdkError: string | null
    connectAccount: UseWalletLinkActionsReturn
    disconnectAccount: UseWalletLinkActionsReturn
    connectedStatus: UseConnectedStatusReturn
}

export const useWalletLink = (
    env: contractEnv = "production",
    watchAccount?: Address,
    chainId?: SupportedChains,
    publicClients?: Record<SupportedChains, PublicClient>,
): UseWalletLinkReturn => {
    const { sdk, loading, error } = useIdentitySDK(env)

    const actions = useWalletLinkActions(sdk)
    const connectedStatus = useConnectedStatus(sdk, watchAccount, chainId, publicClients)

    return {
        sdk,
        sdkLoading: loading,
        sdkError: error,
        connectAccount: actions,
        disconnectAccount: actions,
        connectedStatus,
    }
}

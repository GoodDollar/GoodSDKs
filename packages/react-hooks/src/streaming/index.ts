import { useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { type Address, type Hash, type WalletClient } from "viem"
import { usePublicClient, useWalletClient } from "wagmi"
import {
    StreamingSDK,
    GdaSDK,
    SubgraphClient,
    SupportedChains,
    type StreamInfo,
    type GDAPool,
    type PoolMembership,
    type SUPReserveLocker,
    type Environment,
    type TokenSymbol,
    type CreateStreamParams,
    type UpdateStreamParams,
    type DeleteStreamParams,
} from "@goodsdks/streaming-sdk"

/**
 * Hook parameter interfaces
 */
export interface UseCreateStreamParams {
    receiver: Address
    token?: TokenSymbol | Address
    flowRate: bigint
    environment?: Environment
}

export interface UseUpdateStreamParams {
    receiver: Address
    token?: TokenSymbol | Address
    newFlowRate: bigint
    userData?: `0x${string}`
    environment?: Environment
}

export interface UseDeleteStreamParams {
    receiver: Address
    token?: TokenSymbol | Address
    environment?: Environment
}

export interface UseStreamListParams {
    account: Address
    direction?: "incoming" | "outgoing" | "all"
    environment?: Environment
    enabled?: boolean
}

export interface UseGDAPoolsParams {
    enabled?: boolean
}

export interface UsePoolMembershipsParams {
    account: Address
    enabled?: boolean
}

export interface UseConnectToPoolParams {
    poolAddress: Address
    userData?: `0x${string}`
}

export interface UseDisconnectFromPoolParams {
    poolAddress: Address
    userData?: `0x${string}`
}

export interface UseSupReservesParams {
    environment?: Environment
    apiKey?: string
    enabled?: boolean
}

/**
 * Internal helper to manage SDK instances by environment
 */
const STREAMING_ENVIRONMENTS = ["production", "staging", "development"] as const

function useStreamingSdks(options?: { defaultToken?: TokenSymbol | Address }) {
    const publicClient = usePublicClient()
    const { data: walletClient } = useWalletClient()

    return useMemo(() => {
        const m = new Map<Environment, StreamingSDK>()
        if (!publicClient) return m

        for (const env of STREAMING_ENVIRONMENTS) {
            try {
                m.set(
                    env,
                    new StreamingSDK(
                        publicClient,
                        walletClient ? (walletClient as WalletClient) : undefined,
                        {
                            environment: env,
                            defaultToken: options?.defaultToken
                        }
                    )
                )
            } catch (err) {
                // Silently skip unsupported environments
            }
        }
        return m
    }, [publicClient, walletClient, options?.defaultToken])
}

/**
 * React Hooks for Superfluid operations
 */

/**
 * React Hooks for Superfluid operations
 */
export function useCreateStream() {
    const sdks = useStreamingSdks()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            receiver,
            token,
            flowRate,
            environment = "production",
        }: UseCreateStreamParams): Promise<Hash> => {
            const sdk = sdks.get(environment)
            if (!sdk) throw new Error(`SDK not available for environment: ${environment}`)
            return sdk.createStream({ receiver, token, flowRate })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["streams"] })
        },
    })
}

export function useUpdateStream() {
    const sdks = useStreamingSdks()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            receiver,
            token,
            newFlowRate,
            userData = "0x",
            environment = "production",
        }: UseUpdateStreamParams): Promise<Hash> => {
            const sdk = sdks.get(environment)
            if (!sdk) throw new Error(`SDK not available for environment: ${environment}`)
            return sdk.updateStream({ receiver, token, newFlowRate, userData })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["streams"] })
        },
    })
}

export function useDeleteStream() {
    const sdks = useStreamingSdks()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            receiver,
            token,
            environment = "production",
        }: UseDeleteStreamParams): Promise<Hash> => {
            const sdk = sdks.get(environment)
            if (!sdk) throw new Error(`SDK not available for environment: ${environment}`)
            return sdk.deleteStream({ receiver, token })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["streams"] })
        },
    })
}

export function useStreamList({
    account,
    direction = "all",
    environment = "production",
    enabled = true,
}: UseStreamListParams) {
    const sdks = useStreamingSdks()
    const publicClient = usePublicClient()

    return useQuery<StreamInfo[]>({
        queryKey: ["streams", account, direction, environment, publicClient?.chain?.id],
        queryFn: async () => {
            const sdk = sdks.get(environment)
            if (!sdk) throw new Error(`SDK not available for environment: ${environment}`)
            return sdk.getActiveStreams({ account, direction })
        },
        enabled: enabled && !!account && !!publicClient,
    })
}

export function useGDAPools({
    enabled = true
}: UseGDAPoolsParams = {}) {
    const publicClient = usePublicClient()
    const sdk = useMemo(() => {
        if (!publicClient) return null
        return new GdaSDK(publicClient, undefined, { chainId: publicClient.chain?.id })
    }, [publicClient])

    return useQuery<GDAPool[]>({
        queryKey: ["gda-pools", publicClient?.chain?.id],
        queryFn: async () => {
            if (!sdk) throw new Error("Public client not available")
            return sdk.getDistributionPools()
        },
        enabled: enabled && !!publicClient,
    })
}

export function usePoolMemberships({
    account,
    enabled = true,
}: UsePoolMembershipsParams) {
    const publicClient = usePublicClient()
    const sdk = useMemo(() => {
        if (!publicClient) return null
        return new GdaSDK(publicClient)
    }, [publicClient])

    return useQuery<PoolMembership[]>({
        queryKey: ["gda-memberships", account, publicClient?.chain?.id],
        queryFn: async () => {
            if (!sdk) throw new Error("Public client not available")
            return sdk.getPoolMemberships(account)
        },
        enabled: enabled && !!publicClient && !!account,
    })
}

export function useConnectToPool() {
    const publicClient = usePublicClient()
    const { data: walletClient } = useWalletClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            poolAddress,
            userData = "0x",
        }: UseConnectToPoolParams): Promise<Hash> => {
            if (!publicClient) throw new Error("Public client not available")
            if (!walletClient) throw new Error("Wallet client not available")
            const sdk = new GdaSDK(publicClient, walletClient as WalletClient)
            return sdk.connectToPool({ poolAddress, userData })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["gda-pools"] })
            queryClient.invalidateQueries({ queryKey: ["gda-memberships"] })
        },
    })
}

export function useDisconnectFromPool() {
    const publicClient = usePublicClient()
    const { data: walletClient } = useWalletClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            poolAddress,
            userData = "0x",
        }: UseDisconnectFromPoolParams): Promise<Hash> => {
            if (!publicClient) throw new Error("Public client not available")
            if (!walletClient) throw new Error("Wallet client not available")
            const sdk = new GdaSDK(publicClient, walletClient as WalletClient)
            return sdk.disconnectFromPool({ poolAddress, userData })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["gda-pools"] })
            queryClient.invalidateQueries({ queryKey: ["gda-memberships"] })
        },
    })
}

export function useSupReserves({
    apiKey,
    enabled = true
}: UseSupReservesParams = {}) {
    return useQuery<SUPReserveLocker[]>({
        queryKey: ["sup-reserves", SupportedChains.BASE, apiKey],
        queryFn: async () => {
            const client = new SubgraphClient(SupportedChains.BASE, { apiKey })
            return client.querySUPReserves()
        },
        enabled,
    })
}

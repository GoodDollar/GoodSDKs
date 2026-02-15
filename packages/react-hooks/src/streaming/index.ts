import { useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { type Address, type Hash } from "viem"
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
} from "@goodsdks/streaming-sdk"

/**
 * Hook parameter interfaces
 */
export interface UseCreateStreamParams {
    receiver: Address
    token: Address
    flowRate: bigint
    userData?: `0x${string}`
    environment?: Environment
}

export interface UseUpdateStreamParams {
    receiver: Address
    token: Address
    newFlowRate: bigint
    userData?: `0x${string}`
    environment?: Environment
}

export interface UseDeleteStreamParams {
    receiver: Address
    token: Address
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
 * React Hooks for Superfluid operations
 */
export function useCreateStream() {
    const publicClient = usePublicClient()
    const { data: walletClient } = useWalletClient()
    const queryClient = useQueryClient()

    const sdks = useMemo(() => {
        if (!publicClient) return new Map<string, StreamingSDK>()
        const envs = ["production", "staging", "development"] as const
        const m = new Map<string, StreamingSDK>()
        for (const e of envs) {
            try {
                m.set(e, new StreamingSDK(publicClient, walletClient ? walletClient : undefined, { environment: e }))
            } catch (err) {
                // ignore
            }
        }
        return m
    }, [publicClient, walletClient])

    return useMutation({
        mutationFn: async ({
            receiver,
            token,
            flowRate,
            userData = "0x",
            environment = "production",
        }: UseCreateStreamParams): Promise<Hash> => {
            if (!publicClient) throw new Error("Public client not available")
            if (!walletClient) throw new Error("Wallet client not available")
            const sdk = sdks.get(environment)
            if (!sdk) throw new Error("SDK not available for selected environment")
            return sdk.createStream({ receiver, token, flowRate, userData })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["streams"] })
        },
    })
}

export function useUpdateStream() {
    const publicClient = usePublicClient()
    const { data: walletClient } = useWalletClient()
    const queryClient = useQueryClient()

    const sdks = useMemo(() => {
        if (!publicClient) return new Map<string, StreamingSDK>()
        const envs = ["production", "staging", "development"] as const
        const m = new Map<string, StreamingSDK>()
        for (const e of envs) {
            try {
                m.set(e, new StreamingSDK(publicClient, walletClient as any, { environment: e }))
            } catch (err) {
                // ignore
            }
        }
        return m
    }, [publicClient, walletClient])

    return useMutation({
        mutationFn: async ({
            receiver,
            token,
            newFlowRate,
            userData = "0x",
            environment = "production",
        }: UseUpdateStreamParams): Promise<Hash> => {
            if (!publicClient) throw new Error("Public client not available")
            if (!walletClient) throw new Error("Wallet client not available")
            const sdk = sdks.get(environment)
            if (!sdk) throw new Error("SDK not available for selected environment")
            return sdk.updateStream({ receiver, token, newFlowRate, userData })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["streams"] })
        },
    })
}

export function useDeleteStream() {
    const publicClient = usePublicClient()
    const { data: walletClient } = useWalletClient()
    const queryClient = useQueryClient()

    const sdks = useMemo(() => {
        if (!publicClient) return new Map<string, StreamingSDK>()
        const envs = ["production", "staging", "development"] as const
        const m = new Map<string, StreamingSDK>()
        for (const e of envs) {
            try {
                m.set(e, new StreamingSDK(publicClient, walletClient as any, { environment: e }))
            } catch (err) {
                // ignore
            }
        }
        return m
    }, [publicClient, walletClient])

    return useMutation({
        mutationFn: async ({
            receiver,
            token,
            environment = "production",
        }: UseDeleteStreamParams): Promise<Hash> => {
            if (!publicClient) throw new Error("Public client not available")
            if (!walletClient) throw new Error("Wallet client not available")
            const sdk = sdks.get(environment)
            if (!sdk) throw new Error("SDK not available for selected environment")
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
    const publicClient = usePublicClient()

    return useQuery<StreamInfo[]>({
        queryKey: ["streams", account, direction, environment, publicClient?.chain?.id],
        queryFn: async () => {
            if (!publicClient) throw new Error("Public client not available")
            const sdk = new StreamingSDK(publicClient, undefined, { environment })
            return sdk.getActiveStreams(account, direction)
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
            const sdk = new GdaSDK(publicClient, walletClient as any)
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
            const sdk = new GdaSDK(publicClient, walletClient as any)
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

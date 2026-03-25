import { useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { type Address, type Hash, type WalletClient } from "viem"
import { usePublicClient, useWalletClient } from "wagmi"
import {
    StreamingSDK,
    GdaSDK,
    SubgraphClient,
    SupportedChains,
    type SetStreamParams,
    type StreamInfo,
    type GDAPool,
    type PoolMembership,
    type SUPReserveLocker,
    type Environment,
    type TokenSymbol,
} from "@goodsdks/streaming-sdk"

/**
 * Hook parameter interfaces
 */
export interface UseCreateStreamParams {
    receiver: Address
    token?: TokenSymbol | Address
    flowRate: bigint
    userData?: `0x${string}`
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
    userData?: `0x${string}`
    environment?: Environment
}

/**
 * Params for the recommended create-or-update hook.
 * Uses setFlowrate under the hood — creates when no stream exists, updates otherwise.
 * Pass flowRate = 0n to stop the stream.
 */
export interface UseSetStreamParams {
    receiver?: Address
    token?: TokenSymbol | Address
    flowRate?: bigint
    userData?: `0x${string}`
    environment?: Environment
}

export interface UseStreamListParams {
    account: Address
    direction?: "incoming" | "outgoing" | "all"
    environment?: Environment
    enabled?: boolean
}

export interface UseGDAPoolsParams {
    account: Address
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
    account?: Address
    apiKey?: string
    enabled?: boolean
}

/**
 * Internal helper to manage SDK instances by environment efficiently
 */
function useStreamingSdks(options?: { defaultToken?: TokenSymbol | Address }) {
    const publicClient = usePublicClient()
    const { data: walletClient } = useWalletClient()

    // Use a lazy getter to avoid creating SDKs for all environments at once
    return useMemo(() => {
        const cache = new Map<Environment, StreamingSDK>()

        return {
            get: (env: Environment): StreamingSDK | undefined => {
                if (!publicClient) return undefined
                if (cache.has(env)) return cache.get(env)

                try {
                    const sdk = new StreamingSDK(
                        publicClient,
                        walletClient ? (walletClient as WalletClient) : undefined,
                        {
                            environment: env,
                            defaultToken: options?.defaultToken
                        }
                    )
                    cache.set(env, sdk)
                    return sdk
                } catch (err) {
                    return undefined
                }
            }
        }
    }, [publicClient, walletClient, options?.defaultToken])
}

/**
 * React Hooks for Superfluid operations
 */

/**
 * React Hooks for Creating Streams
 */
export function useCreateStream() {
    const sdks = useStreamingSdks()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            receiver,
            token,
            flowRate,
            userData = "0x",
            environment = "production",
        }: UseCreateStreamParams): Promise<Hash> => {
            const sdk = sdks.get(environment)
            if (!sdk) throw new Error(`SDK not available for environment: ${environment}`)
            return sdk.createStream({ receiver, token, flowRate, userData })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["streams"] })
        },
    })
}

/**
 * Recommended hook for creating or updating a stream.
 * Uses setFlowrate under the hood — handles both create and update in one call.
 * Pass flowRate = 0n to stop/delete the stream.
 */
export function useSetStream() {
    const sdks = useStreamingSdks()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            receiver,
            token,
            flowRate,
            environment = "production",
        }: UseSetStreamParams & { environment?: Environment }): Promise<Hash> => {
            if (!receiver) throw new Error("Receiver address is required")
            if (flowRate === undefined) throw new Error("Flow rate is required")
            const sdk = sdks.get(environment)
            if (!sdk) throw new Error(`SDK not available for environment: ${environment}`)
            return sdk.createOrUpdateStream({ receiver, token, flowRate })
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
            userData = "0x",
        }: UseDeleteStreamParams): Promise<Hash> => {
            const sdk = sdks.get(environment)
            if (!sdk) throw new Error(`SDK not available for environment: ${environment}`)
            return sdk.deleteStream({ receiver, token, userData })
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
    account,
    enabled = true,
}: UseGDAPoolsParams) {
    const publicClient = usePublicClient()
    const sdk = useMemo(() => {
        if (!publicClient) return null
        try {
            return new GdaSDK(publicClient, undefined, { chainId: publicClient.chain?.id })
        } catch (e) {
            return null
        }
    }, [publicClient])

    return useQuery<GDAPool[]>({
        queryKey: ["gda-pools", account, publicClient?.chain?.id],
        queryFn: async () => {
            if (!sdk) throw new Error("Public client not available")
            return sdk.getDistributionPools(account)
        },
        enabled: enabled && !!publicClient && !!account,
    })
}

export function usePoolMemberships({
    account,
    enabled = true,
}: UsePoolMembershipsParams) {
    const publicClient = usePublicClient()
    const sdk = useMemo(() => {
        if (!publicClient) return null
        try {
            return new GdaSDK(publicClient)
        } catch (e) {
            return null
        }
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
    account,
    apiKey,
    enabled = true
}: UseSupReservesParams = {}) {
    return useQuery<SUPReserveLocker[]>({
        queryKey: ["sup-reserves", SupportedChains.BASE, account, apiKey],
        queryFn: async () => {
            if (!apiKey) {
                throw new Error(
                    "Missing apiKey for SUP reserves subgraph (The Graph Gateway). " +
                    "Provide `apiKey` (in the demo app, set `VITE_GRAPH_API_KEY`)."
                )
            }
            if (!account) throw new Error("account is required to fetch SUP reserves")
            const client = new SubgraphClient(SupportedChains.BASE, { apiKey })
            return client.querySUPReserves(account)
        },
        enabled: enabled && !!apiKey && !!account,
    })
}

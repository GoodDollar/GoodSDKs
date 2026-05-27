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
    type PoolMembership,
    type SUPReserveLocker,
    type SuperTokenBalance,
    getSuperTokenAddressForSymbolSafe,
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
    environment?: Environment
}

export interface UseStreamListParams {
    account: Address
    direction?: "incoming" | "outgoing" | "all"
    environment?: Environment
    first?: number
    skip?: number
    enabled?: boolean
}

export interface UseStreamingSDKParams {
    environment?: Environment
    defaultToken?: TokenSymbol | Address
}

export interface UseSuperTokenBalanceParams {
    account?: Address
    token?: TokenSymbol | Address
    environment?: Environment
    enabled?: boolean
}

export interface UseBalanceHistoryParams {
    account?: Address
    token?: TokenSymbol | Address
    fromTimestamp?: number
    toTimestamp?: number
    first?: number
    skip?: number
    environment?: Environment
    enabled?: boolean
}

export interface UseFlowRateParams {
    sender?: Address
    receiver?: Address
    token?: TokenSymbol | Address
    environment?: Environment
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

function resolveTokenFilter(
    chainId: number | undefined,
    environment: Environment,
    token?: TokenSymbol | Address,
): Address | undefined {
    if (!token) return undefined
    if (token === "G$" || token === "SUP") {
        return getSuperTokenAddressForSymbolSafe(chainId, environment, token)
    }
    return token
}

function invalidateStreamingQueries(queryClient: ReturnType<typeof useQueryClient>) {
    queryClient.invalidateQueries({ queryKey: ["streams"] })
    queryClient.invalidateQueries({ queryKey: ["super-token-balance"] })
    queryClient.invalidateQueries({ queryKey: ["balance-history"] })
    queryClient.invalidateQueries({ queryKey: ["flow-rate"] })
}

export function useStreamingSDK({
    environment = "production",
    defaultToken,
}: UseStreamingSDKParams = {}) {
    const publicClient = usePublicClient()
    const { data: walletClient } = useWalletClient()

    const result = useMemo(() => {
        if (!publicClient) {
            return { sdk: null as StreamingSDK | null, error: null as string | null }
        }

        try {
            return {
                sdk: new StreamingSDK(
                    publicClient,
                    walletClient ? (walletClient as WalletClient) : undefined,
                    { environment, defaultToken },
                ),
                error: null,
            }
        } catch (error) {
            return {
                sdk: null,
                error: error instanceof Error ? error.message : "Failed to initialize StreamingSDK",
            }
        }
    }, [defaultToken, environment, publicClient, walletClient])

    return {
        sdk: result.sdk,
        loading: !publicClient,
        error: result.error,
    }
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
            invalidateStreamingQueries(queryClient)
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
            invalidateStreamingQueries(queryClient)
        },
    })
}

/**
 * Low-level explicit updateFlow wrapper.
 * Prefer useSetStream() for the recommended setFlowrate path.
 */
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
            invalidateStreamingQueries(queryClient)
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
            invalidateStreamingQueries(queryClient)
        },
    })
}

export function useStreamList({
    account,
    direction = "all",
    environment = "production",
    first,
    skip,
    enabled = true,
}: UseStreamListParams) {
    const sdks = useStreamingSdks()
    const publicClient = usePublicClient()

    return useQuery<StreamInfo[]>({
        queryKey: ["streams", account, direction, environment, first, skip, publicClient?.chain?.id],
        queryFn: async () => {
            const sdk = sdks.get(environment)
            if (!sdk) throw new Error(`SDK not available for environment: ${environment}`)
            return sdk.getActiveStreams({ account, direction, first, skip })
        },
        enabled: enabled && !!account && !!publicClient,
    })
}

export function useSuperTokenBalance({
    account,
    token,
    environment = "production",
    enabled = true,
}: UseSuperTokenBalanceParams) {
    const sdks = useStreamingSdks()
    const publicClient = usePublicClient()

    return useQuery<bigint>({
        queryKey: [
            "super-token-balance",
            account,
            token,
            environment,
            publicClient?.chain?.id,
        ],
        queryFn: async () => {
            if (!account) throw new Error("Account is required")
            const sdk = sdks.get(environment)
            if (!sdk) throw new Error(`SDK not available for environment: ${environment}`)
            return sdk.getSuperTokenBalance(account, token)
        },
        enabled: enabled && !!account && !!publicClient,
    })
}

export function useBalanceHistory({
    account,
    token,
    fromTimestamp,
    toTimestamp,
    first,
    skip,
    environment = "production",
    enabled = true,
}: UseBalanceHistoryParams) {
    const sdks = useStreamingSdks()
    const publicClient = usePublicClient()

    return useQuery<SuperTokenBalance[]>({
        queryKey: [
            "balance-history",
            account,
            token,
            fromTimestamp,
            toTimestamp,
            first,
            skip,
            environment,
            publicClient?.chain?.id,
        ],
        queryFn: async () => {
            if (!account) throw new Error("Account is required")
            const sdk = sdks.get(environment)
            if (!sdk) throw new Error(`SDK not available for environment: ${environment}`)

            const history = await sdk.getBalanceHistory({
                account,
                fromTimestamp,
                toTimestamp,
                first,
                skip,
            })

            const tokenFilter = resolveTokenFilter(publicClient?.chain?.id, environment, token)
            if ((token === "G$" || token === "SUP") && !tokenFilter) return []
            if (!tokenFilter) return history

            return history.filter(
                (entry) => entry.token.toLowerCase() === tokenFilter.toLowerCase(),
            )
        },
        enabled: enabled && !!account && !!publicClient,
    })
}

export function useFlowRate({
    sender,
    receiver,
    token,
    environment = "production",
    enabled = true,
}: UseFlowRateParams) {
    const sdks = useStreamingSdks()
    const publicClient = usePublicClient()

    return useQuery<bigint>({
        queryKey: [
            "flow-rate",
            sender,
            receiver,
            token,
            environment,
            publicClient?.chain?.id,
        ],
        queryFn: async () => {
            if (!sender) throw new Error("Sender is required")
            if (!receiver) throw new Error("Receiver is required")
            const sdk = sdks.get(environment)
            if (!sdk) throw new Error(`SDK not available for environment: ${environment}`)
            return sdk.getFlowRate({ sender, receiver, token })
        },
        enabled: enabled && !!sender && !!receiver && !!publicClient,
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

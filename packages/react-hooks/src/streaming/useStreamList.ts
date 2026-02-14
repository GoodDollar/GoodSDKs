import { useQuery } from "@tanstack/react-query"
import { type Address } from "viem"
import { usePublicClient } from "wagmi"
import { StreamingSDK, type StreamInfo } from "@goodsdks/streaming-sdk"

export interface UseStreamListParams {
    account: Address
    direction?: "incoming" | "outgoing" | "all"
    environment?: "production" | "staging" | "development"
    enabled?: boolean
}

/**
 * Hook for fetching active streams for an account
 */
export function useStreamList({
    account,
    direction = "all",
    environment = "production",
    enabled = true,
}: UseStreamListParams) {
    const publicClient = usePublicClient()

    return useQuery<StreamInfo[]>({
        queryKey: ["streams", account, direction, environment],
        queryFn: async () => {
            if (!publicClient) {
                throw new Error("Public client not available")
            }

            const sdk = new StreamingSDK(publicClient, undefined, {
                environment,
            })

            return sdk.getActiveStreams(account, direction)
        },
        enabled: enabled && !!account && !!publicClient,
    })
}

import { useQuery } from "@tanstack/react-query"
import { usePublicClient } from "wagmi"
import { GdaSDK, type GDAPool } from "@goodsdks/streaming-sdk"

export interface UseGDAPoolsParams {
    environment?: "production" | "staging" | "development"
    enabled?: boolean
}

/**
 * Hook for fetching GDA distribution pools
 */
export function useGDAPools({
    environment = "production",
    enabled = true,
}: UseGDAPoolsParams = {}) {
    const publicClient = usePublicClient()

    return useQuery<GDAPool[]>({
        queryKey: ["gda-pools", environment],
        queryFn: async () => {
            if (!publicClient) {
                throw new Error("Public client not available")
            }

            const sdk = new GdaSDK(publicClient)

            return sdk.getDistributionPools()
        },
        enabled: enabled && !!publicClient,
    })
}

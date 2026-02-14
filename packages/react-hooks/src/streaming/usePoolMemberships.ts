import { useQuery } from "@tanstack/react-query"
import { usePublicClient } from "wagmi"
import { GdaSDK, type PoolMembership } from "@goodsdks/streaming-sdk"
import { type Address } from "viem"

export interface UsePoolMembershipsParams {
    account: Address
    environment?: "production" | "staging" | "development"
    enabled?: boolean
}

export function usePoolMemberships({
    account,
    environment = "production",
    enabled = true,
}: UsePoolMembershipsParams) {
    const publicClient = usePublicClient()

    return useQuery<PoolMembership[]>({
        queryKey: ["gda-memberships", account, environment],
        queryFn: async () => {
            if (!publicClient) {
                throw new Error("Public client not available")
            }

            const sdk = new GdaSDK(publicClient)

            return sdk.getPoolMemberships(account)
        },
        enabled: enabled && !!publicClient && !!account,
    })
}

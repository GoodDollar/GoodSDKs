import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type Address, type Hash } from "viem"
import { usePublicClient, useWalletClient } from "wagmi"
import { GdaSDK } from "@goodsdks/streaming-sdk"

export interface UseConnectToPoolParams {
    poolAddress: Address
    userData?: `0x${string}`
}

/**
 * Hook for connecting to a GDA distribution pool
 */
export function useConnectToPool() {
    const publicClient = usePublicClient()
    const { data: walletClient } = useWalletClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            poolAddress,
            userData = "0x",
        }: UseConnectToPoolParams): Promise<Hash> => {
            if (!publicClient) {
                throw new Error("Public client not available")
            }
            if (!walletClient) {
                throw new Error("Wallet client not available")
            }

            const sdk = new GdaSDK(publicClient, walletClient)

            return sdk.connectToPool({ poolAddress, userData })
        },
        onSuccess: () => {
            // Invalidate pools and memberships queries
            queryClient.invalidateQueries({ queryKey: ["gda-pools"] })
            queryClient.invalidateQueries({ queryKey: ["gda-memberships"] })
        },
    })
}

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type Address, type Hash } from "viem"
import { usePublicClient, useWalletClient } from "wagmi"
import { StreamingSDK } from "@goodsdks/streaming-sdk"

export interface UseUpdateStreamParams {
    receiver: Address
    token: Address
    newFlowRate: bigint
    userData?: `0x${string}`
    environment?: "production" | "staging" | "development"
}

/**
 * Hook for updating a Superfluid stream's flow rate
 */
export function useUpdateStream() {
    const publicClient = usePublicClient()
    const { data: walletClient } = useWalletClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            receiver,
            token,
            newFlowRate,
            userData = "0x",
            environment = "production",
        }: UseUpdateStreamParams): Promise<Hash> => {
            if (!publicClient) {
                throw new Error("Public client not available")
            }
            if (!walletClient) {
                throw new Error("Wallet client not available")
            }

            const sdk = new StreamingSDK(publicClient, walletClient, {
                environment,
            })

            return sdk.updateStream({ receiver, token, newFlowRate, userData })
        },
        onSuccess: () => {
            // Invalidate streams query to refetch
            queryClient.invalidateQueries({ queryKey: ["streams"] })
        },
    })
}

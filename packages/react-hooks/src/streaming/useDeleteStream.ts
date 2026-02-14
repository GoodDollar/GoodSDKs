import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type Address, type Hash } from "viem"
import { usePublicClient, useWalletClient } from "wagmi"
import { StreamingSDK } from "@goodsdks/streaming-sdk"

export interface UseDeleteStreamParams {
    receiver: Address
    token: Address
    environment?: "production" | "staging" | "development"
}

/**
 * Hook for deleting a Superfluid stream
 */
export function useDeleteStream() {
    const publicClient = usePublicClient()
    const { data: walletClient } = useWalletClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            receiver,
            token,
            environment = "production",
        }: UseDeleteStreamParams): Promise<Hash> => {
            if (!publicClient) {
                throw new Error("Public client not available")
            }
            if (!walletClient) {
                throw new Error("Wallet client not available")
            }

            const sdk = new StreamingSDK(publicClient, walletClient, {
                environment,
            })

            return sdk.deleteStream({ receiver, token })
        },
        onSuccess: () => {
            // Invalidate streams query to refetch
            queryClient.invalidateQueries({ queryKey: ["streams"] })
        },
    })
}

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type Address, type Hash } from "viem"
import { usePublicClient, useWalletClient } from "wagmi"
import { StreamingSDK } from "@goodsdks/streaming-sdk"

export interface UseCreateStreamParams {
    receiver: Address
    token: Address
    flowRate: bigint
    userData?: `0x${string}`
    environment?: "production" | "staging" | "development"
}

/**
 * Hook for creating a Superfluid stream
 */
export function useCreateStream() {
    const publicClient = usePublicClient()
    const { data: walletClient } = useWalletClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            receiver,
            token,
            flowRate,
            userData = "0x",
            environment = "production",
        }: UseCreateStreamParams): Promise<Hash> => {
            if (!publicClient) {
                throw new Error("Public client not available")
            }
            if (!walletClient) {
                throw new Error("Wallet client not available")
            }

            const sdk = new StreamingSDK(publicClient, walletClient, {
                environment,
            })

            return sdk.createStream({ receiver, token, flowRate, userData })
        },
        onSuccess: () => {
            // Invalidate streams query to refetch
            queryClient.invalidateQueries({ queryKey: ["streams"] })
        },
    })
}

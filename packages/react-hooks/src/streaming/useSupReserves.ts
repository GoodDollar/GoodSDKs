import { useQuery } from "@tanstack/react-query"
import { SubgraphClient, type SUPReserveLocker, SupportedChains } from "@goodsdks/streaming-sdk"

export interface UseSupReservesParams {
    enabled?: boolean
}

export function useSupReserves({ enabled = true }: UseSupReservesParams = {}) {
    return useQuery<SUPReserveLocker[]>({
        queryKey: ["sup-reserves"],
        queryFn: async () => {
            // We use BASE for SUP reserves as per requirements
            const client = new SubgraphClient(SupportedChains.BASE)
            return client.querySUPReserves()
        },
        enabled,
    })
}

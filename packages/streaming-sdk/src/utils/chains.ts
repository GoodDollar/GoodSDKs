import { Address } from "viem"
import {
    SupportedChains,
    G$_SUPERTOKEN_ADDRESSES,
    CHAIN_CONFIGS,
} from "../constants"
import { Environment } from "../types"

export function isSupportedChain(
    chainId: number | undefined,
): chainId is SupportedChains {
    return (
        chainId === SupportedChains.CELO ||
        chainId === SupportedChains.CELO_ALFAJORES ||
        chainId === SupportedChains.BASE ||
        chainId === SupportedChains.BASE_SEPOLIA
    )
}

export function validateChain(chainId: number | undefined): SupportedChains {
    if (!isSupportedChain(chainId)) {
        throw new Error(
            `Unsupported chain ID: ${chainId}. Supported chains: Celo (42220), Alfajores (44787), Base (8453), Base Sepolia (84532)`,
        )
    }
    return chainId
}

export function getSuperTokenAddress(
    chainId: SupportedChains,
    environment: Environment,
): Address {
    const address = G$_SUPERTOKEN_ADDRESSES[environment][chainId]

    if (!address) {
        throw new Error(
            `G$ SuperToken address not configured for chain ${CHAIN_CONFIGS[chainId].name} in ${environment} environment`,
        )
    }

    return address
}

export function getChainConfig(chainId: SupportedChains) {
    return CHAIN_CONFIGS[chainId]
}

import { Address } from "viem"
import { Environment } from "./types"
import { cfaForwarderAddress, gdaForwarderAddress } from "@sfpro/sdk/abi"
import { hostAddress } from "@sfpro/sdk/abi/core"

// Network definitions
export enum SupportedChains {
    CELO = 42220,
    CELO_ALFAJORES = 44787,
    BASE = 8453,
    BASE_SEPOLIA = 84532,
}

export type SupportedChainId = SupportedChains

/**
 * Get G$ SuperToken address for a given chain and environment.
 * Returning undefined for chains like Base where G$ is not yet deployed.
 */
export function getG$Token(
    chainId: number,
    env: Environment = 'production'
): Address | undefined {
    const addresses: Record<Environment, Partial<Record<number, Address>>> = {
        production: {
            [SupportedChains.CELO]: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A",
        },
        staging: {
            [SupportedChains.CELO]: "0x61FA0fB802fd8345C06da558240E0651886fec69",
        },
        development: {
            [SupportedChains.CELO_ALFAJORES]: "0xFa51eFDc0910CCdA91732e6806912Fa12e2FD475",
            [SupportedChains.CELO]: "0xFa51eFDc0910CCdA91732e6806912Fa12e2FD475", // Fallback for local testing
        },
    }

    return addresses[env]?.[chainId]
}

// Protocol indexers
export const SUBGRAPH_URLS: Record<number | string, string> = {
    [SupportedChains.CELO]: "https://celo-mainnet.subgraph.x.superfluid.dev/",
    [SupportedChains.CELO_ALFAJORES]:
        "https://celo-alfajores.subgraph.x.superfluid.dev/",
    [SupportedChains.BASE]: "https://base-mainnet.subgraph.x.superfluid.dev/",
    [SupportedChains.BASE_SEPOLIA]:
        "https://base-sepolia.subgraph.x.superfluid.dev/",
    supReserve:
        "https://gateway.thegraph.com/api/subgraphs/id/6dRuPxMvaJAp32hvcTsYbAya69A4t1KUHh2EnV3YQeXU",
}

// Standard protocol interfaces
export const CFA_FORWARDER_ADDRESSES = cfaForwarderAddress
export const GDA_FORWARDER_ADDRESSES = gdaForwarderAddress
export const HOST_ADDRESSES = hostAddress

// Metadata for frontend integration
export interface ChainConfig {
    id: SupportedChains
    name: string
    rpcUrls: string[]
    explorer: string
}

export const CHAIN_CONFIGS: Record<SupportedChains, ChainConfig> = {
    [SupportedChains.CELO]: {
        id: SupportedChains.CELO,
        name: "Celo",
        rpcUrls: ["https://forno.celo.org"],
        explorer: "https://celoscan.io",
    },
    [SupportedChains.CELO_ALFAJORES]: {
        id: SupportedChains.CELO_ALFAJORES,
        name: "Celo Alfajores",
        rpcUrls: ["https://alfajores-forno.celo-testnet.org"],
        explorer: "https://alfajores.celoscan.io",
    },
    [SupportedChains.BASE]: {
        id: SupportedChains.BASE,
        name: "Base",
        rpcUrls: ["https://mainnet.base.org"],
        explorer: "https://basescan.org",
    },
    [SupportedChains.BASE_SEPOLIA]: {
        id: SupportedChains.BASE_SEPOLIA,
        name: "Base Sepolia",
        rpcUrls: ["https://sepolia.base.org"],
        explorer: "https://sepolia.basescan.org",
    },
}

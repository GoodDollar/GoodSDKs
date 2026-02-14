import { Address } from "viem"
import { Environment } from "./types"

// Supported chains
export enum SupportedChains {
    CELO = 42220,
    CELO_ALFAJORES = 44787,
    BASE = 8453,
    BASE_SEPOLIA = 84532,
}

export type SupportedChainId = SupportedChains

// G$ SuperToken addresses per environment and chain
export const G$_SUPERTOKEN_ADDRESSES: Record<
    Environment,
    Partial<Record<SupportedChains, Address>>
> = {
    production: {
        [SupportedChains.CELO]: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A",
        // Base address TBD
    },
    staging: {
        [SupportedChains.CELO]: "0x61FA0fB802fd8345C06da558240E0651886fec69",
        // Base address TBD
    },
    development: {
        [SupportedChains.CELO_ALFAJORES]:
            "0xFa51eFDc0910CCdA91732e6806912Fa12e2FD475",
        // Base Sepolia address TBD
    },
}

// Superfluid subgraph endpoints
export const SUBGRAPH_URLS: Record<number | string, string> = {
    [SupportedChains.CELO]: "https://celo-mainnet.subgraph.x.superfluid.dev/",
    [SupportedChains.CELO_ALFAJORES]:
        "https://celo-alfajores.subgraph.x.superfluid.dev/",
    [SupportedChains.BASE]: "https://base-mainnet.subgraph.x.superfluid.dev/",
    [SupportedChains.BASE_SEPOLIA]:
        "https://base-sepolia.subgraph.x.superfluid.dev/",
    supReserve:
        "https://thegraph.com/explorer/subgraphs/6dRuPxMvaJAp32hvcTsYbAya69A4t1KUHh2EnV3YQeXU",
}

// Chain configuration
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
        rpcUrls: ["https://forno.celo.org", "https://rpc.ankr.com/celo"],
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
        rpcUrls: ["https://mainnet.base.org", "https://base.llamarpc.com"],
        explorer: "https://basescan.org",
    },
    [SupportedChains.BASE_SEPOLIA]: {
        id: SupportedChains.BASE_SEPOLIA,
        name: "Base Sepolia",
        rpcUrls: ["https://sepolia.base.org"],
        explorer: "https://sepolia.basescan.org",
    },
}

import { cfaForwarderAddress, gdaForwarderAddress } from "@sfpro/sdk/abi"


// Superfluid Forwarder addresses (pulled from @sfpro/sdk)
export const CFA_FORWARDER_ADDRESSES: Record<SupportedChains, Address> = {
    [SupportedChains.CELO]: cfaForwarderAddress[SupportedChains.CELO],
    [SupportedChains.CELO_ALFAJORES]:
        (cfaForwarderAddress as any)[SupportedChains.CELO_ALFAJORES] ||
        (cfaForwarderAddress as any)[44787] ||
        "0xcfA132E353cB4E398080B9700609bb008eceB125",
    [SupportedChains.BASE]: cfaForwarderAddress[SupportedChains.BASE],
    [SupportedChains.BASE_SEPOLIA]:
        (cfaForwarderAddress as any)[SupportedChains.BASE_SEPOLIA] ||
        (cfaForwarderAddress as any)[84532] ||
        "0xcfA132E353cB4E398080B9700609bb008eceB125",
}

export const GDA_FORWARDER_ADDRESSES: Record<SupportedChains, Address> = {
    [SupportedChains.CELO]: gdaForwarderAddress[SupportedChains.CELO],
    [SupportedChains.CELO_ALFAJORES]:
        (gdaForwarderAddress as any)[SupportedChains.CELO_ALFAJORES] ||
        (gdaForwarderAddress as any)[44787] ||
        "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08",
    [SupportedChains.BASE]: gdaForwarderAddress[SupportedChains.BASE],
    [SupportedChains.BASE_SEPOLIA]:
        (gdaForwarderAddress as any)[SupportedChains.BASE_SEPOLIA] ||
        (gdaForwarderAddress as any)[84532] ||
        "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08",
}

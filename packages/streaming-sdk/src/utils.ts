import { Address, parseEther, formatEther } from "viem"
import {
    SupportedChains,
    CHAIN_CONFIGS,
    getG$Token,
} from "./constants"
import { Environment } from "./types"

/**
 * Chain utilities
 */
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
    const address = getG$Token(chainId, environment)
    if (!address) {
        throw new Error(
            `G$ SuperToken address not configured for chain ${CHAIN_CONFIGS[chainId].name} in ${environment} environment`,
        )
    }
    return address
}

export function getSuperTokenAddressSafe(
    chainId: number | undefined,
    environment: Environment,
): Address | undefined {
    if (!isSupportedChain(chainId)) return undefined
    return getG$Token(chainId, environment)
}

export function getChainConfig(chainId: SupportedChains) {
    return CHAIN_CONFIGS[chainId]
}

/**
 * Flow rate conversion utilities
 */
export type TimeUnit = "second" | "minute" | "hour" | "day" | "week" | "month" | "year"

const TIME_UNITS_IN_SECONDS: Record<TimeUnit, number> = {
    second: 1,
    minute: 60,
    hour: 3600,
    day: 86400,
    week: 604800,
    month: 2592000,
    year: 31536000,
}

export function calculateFlowRate(
    amountWei: bigint,
    timeUnit: TimeUnit,
): bigint {
    const secondsInUnit = BigInt(TIME_UNITS_IN_SECONDS[timeUnit])
    return amountWei / secondsInUnit
}

export function calculateStreamedAmount(
    flowRate: bigint,
    durationSeconds: bigint,
): bigint {
    return flowRate * durationSeconds
}

export function formatFlowRate(flowRate: bigint, timeUnit: TimeUnit): string {
    const secondsInUnit = BigInt(TIME_UNITS_IN_SECONDS[timeUnit])
    const amountPerUnit = flowRate * secondsInUnit
    const formatted = formatEther(amountPerUnit)
    const [integer, fraction] = formatted.split(".")
    if (fraction && fraction.length > 4) {
        return `${integer}.${fraction.slice(0, 4)} tokens/${timeUnit}`
    }
    return `${formatted} tokens/${timeUnit}`
}

export function flowRateFromAmount(
    amount: string,
    timeUnit: TimeUnit,
): bigint {
    const amountWei = parseEther(amount)
    return calculateFlowRate(amountWei, timeUnit)
}

import { parseEther, formatEther } from "viem"

export type TimeUnit = "second" | "minute" | "hour" | "day" | "week" | "month" | "year"

const TIME_UNITS_IN_SECONDS: Record<TimeUnit, number> = {
    second: 1,
    minute: 60,
    hour: 3600,
    day: 86400,
    week: 604800,
    month: 2592000, // 30 days
    year: 31536000, // 365 days
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

    // Round to 4 decimal places for cleaner UI
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

import { describe, it, expect } from "vitest"
import {
    calculateFlowRate,
    calculateStreamedAmount,
    formatFlowRate,
    flowRateFromAmount,
} from "./flowrate"
import { parseEther } from "viem"

describe("Flow Rate Utilities", () => {
    describe("calculateFlowRate", () => {
        it("should calculate flow rate per second", () => {
            const amountWei = parseEther("100") // 100 tokens
            const flowRate = calculateFlowRate(amountWei, "second")

            expect(flowRate).toEqual(parseEther("100"))
        })

        it("should calculate flow rate per month", () => {
            const amountWei = parseEther("100") // 100 tokens/month
            const flowRate = calculateFlowRate(amountWei, "month")

            // 100 tokens / 2592000 seconds
            const expected = parseEther("100") / BigInt(2592000)
            expect(flowRate).toEqual(expected)
        })

        it("should calculate flow rate per year", () => {
            const amountWei = parseEther("1000") // 1000 tokens/year
            const flowRate = calculateFlowRate(amountWei, "year")

            const expected = parseEther("1000") / BigInt(31536000)
            expect(flowRate).toEqual(expected)
        })

        it("should calculate flow rate per minute", () => {
            const amountWei = parseEther("60") // 60 tokens/minute
            const flowRate = calculateFlowRate(amountWei, "minute")

            const expected = parseEther("60") / BigInt(60)
            expect(flowRate).toEqual(expected)
        })

        it("should calculate flow rate per hour", () => {
            const amountWei = parseEther("3600") // 3600 tokens/hour
            const flowRate = calculateFlowRate(amountWei, "hour")

            const expected = parseEther("3600") / BigInt(3600)
            expect(flowRate).toEqual(expected)
        })

        it("should calculate flow rate per day", () => {
            const amountWei = parseEther("86400") // 86400 tokens/day
            const flowRate = calculateFlowRate(amountWei, "day")

            const expected = parseEther("86400") / BigInt(86400)
            expect(flowRate).toEqual(expected)
        })

        it("should calculate flow rate per week", () => {
            const amountWei = parseEther("604800") // 604800 tokens/week
            const flowRate = calculateFlowRate(amountWei, "week")

            const expected = parseEther("604800") / BigInt(604800)
            expect(flowRate).toEqual(expected)
        })
    })

    describe("calculateStreamedAmount", () => {
        it("should calculate streamed amount over duration", () => {
            const flowRate = BigInt("1000000000000000") // wei per second
            const duration = BigInt(3600) // 1 hour

            const amount = calculateStreamedAmount(flowRate, duration)

            expect(amount).toEqual(flowRate * duration)
        })

        it("should calculate zero for zero duration", () => {
            const flowRate = BigInt("1000000000000000")
            const duration = BigInt(0)

            const amount = calculateStreamedAmount(flowRate, duration)

            expect(amount).toEqual(BigInt(0))
        })

        it("should calculate zero for zero flow rate", () => {
            const flowRate = BigInt(0)
            const duration = BigInt(3600)

            const amount = calculateStreamedAmount(flowRate, duration)

            expect(amount).toEqual(BigInt(0))
        })
    })

    describe("formatFlowRate", () => {
        it("should format flow rate to readable string", () => {
            const flowRate = parseEther("100") / BigInt(2592000) // 100/month

            const formatted = formatFlowRate(flowRate, "month")

            expect(formatted).toContain("tokens/month")
            // Allow for floating point precision issues
            expect(formatted).toMatch(/99\.9+|100/)
        })

        it("should format flow rate per second", () => {
            const flowRate = parseEther("1")

            const formatted = formatFlowRate(flowRate, "second")

            expect(formatted).toContain("tokens/second")
            expect(formatted).toContain("1")
        })
    })

    describe("flowRateFromAmount", () => {
        it("should calculate flow rate from string amount", () => {
            const flowRate = flowRateFromAmount("100", "month")

            const expected = parseEther("100") / BigInt(2592000)
            expect(flowRate).toEqual(expected)
        })

        it("should calculate flow rate from decimal string", () => {
            const flowRate = flowRateFromAmount("10.5", "day")

            const expected = parseEther("10.5") / BigInt(86400)
            expect(flowRate).toEqual(expected)
        })
    })
})

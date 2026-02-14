import { describe, it, expect } from "vitest"
import {
    isSupportedChain,
    validateChain,
    getSuperTokenAddress,
    getChainConfig,
} from "./chains"
import { SupportedChains } from "../constants"

describe("Chain Utilities", () => {
    describe("isSupportedChain", () => {
        it("should return true for Celo", () => {
            expect(isSupportedChain(42220)).toBe(true)
        })

        it("should return true for Base", () => {
            expect(isSupportedChain(8453)).toBe(true)
        })

        it("should return false for unsupported chains", () => {
            expect(isSupportedChain(1)).toBe(false) // Ethereum
            expect(isSupportedChain(137)).toBe(false) // Polygon
            expect(isSupportedChain(undefined)).toBe(false)
            expect(isSupportedChain(999999)).toBe(false)
        })
    })

    describe("validateChain", () => {
        it("should return chain ID for supported chains", () => {
            expect(validateChain(42220)).toEqual(SupportedChains.CELO)
            expect(validateChain(8453)).toEqual(SupportedChains.BASE)
        })

        it("should throw error for unsupported chains", () => {
            expect(() => validateChain(1)).toThrow("Unsupported chain")
            expect(() => validateChain(undefined)).toThrow("Unsupported chain")
            expect(() => validateChain(999999)).toThrow(
                "Supported chains: Celo (42220), Alfajores (44787), Base (8453), Base Sepolia (84532)",
            )
        })
    })

    describe("getSuperTokenAddress", () => {
        it("should return production address for Celo", () => {
            const address = getSuperTokenAddress(
                SupportedChains.CELO,
                "production",
            )

            expect(address).toEqual(
                "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A",
            )
        })

        it("should return staging address for Celo", () => {
            const address = getSuperTokenAddress(
                SupportedChains.CELO,
                "staging",
            )

            expect(address).toEqual(
                "0x61FA0fB802fd8345C06da558240E0651886fec69",
            )
        })

        it("should return development address for Celo Alfajores", () => {
            const address = getSuperTokenAddress(
                SupportedChains.CELO_ALFAJORES,
                "development",
            )

            expect(address).toEqual(
                "0xFa51eFDc0910CCdA91732e6806912Fa12e2FD475",
            )
        })

        it("should throw error for unconfigured chain/env combination", () => {
            expect(() => {
                getSuperTokenAddress(SupportedChains.BASE, "production")
            }).toThrow("G$ SuperToken address not configured")

            expect(() => {
                getSuperTokenAddress(SupportedChains.BASE, "staging")
            }).toThrow("G$ SuperToken address not configured")
        })
    })

    describe("getChainConfig", () => {
        it("should return Celo config", () => {
            const config = getChainConfig(SupportedChains.CELO)

            expect(config.id).toEqual(SupportedChains.CELO)
            expect(config.name).toEqual("Celo")
            expect(config.rpcUrls).toContain("https://forno.celo.org")
            expect(config.rpcUrls).toContain("https://rpc.ankr.com/celo")
            expect(config.explorer).toEqual("https://celoscan.io")
        })

        it("should return Base config", () => {
            const config = getChainConfig(SupportedChains.BASE)

            expect(config.id).toEqual(SupportedChains.BASE)
            expect(config.name).toEqual("Base")
            expect(config.rpcUrls).toContain("https://mainnet.base.org")
            expect(config.rpcUrls).toContain("https://base.llamarpc.com")
            expect(config.explorer).toEqual("https://basescan.org")
        })
    })
})

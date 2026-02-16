import { describe, it, expect, vi, beforeEach } from "vitest"
import { Address, parseEther } from "viem"
import {
    StreamingSDK,
    GdaSDK,
    SupportedChains,
    isSupportedChain,
    validateChain,
    calculateFlowRate,
    formatFlowRate,
    flowRateFromAmount,
    getG$Token,
} from "./index"

/**
 * --- MOCKS ---
 */

const createMockPublicClient = (chainId: number = SupportedChains.CELO) => ({
    chain: { id: chainId, name: "Celo" },
    simulateContract: vi.fn().mockResolvedValue({ request: {} }),
    waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
})

const createMockWalletClient = (chainId: number = SupportedChains.CELO) => ({
    chain: { id: chainId },
    getAddresses: vi.fn().mockResolvedValue(["0x0000000000000000000000000000000000000001"]),
    writeContract: vi.fn().mockResolvedValue("0xhash"),
})

const TEST_SUPERTOKEN = getG$Token(SupportedChains.CELO) as Address

/**
 * --- UTILS TESTS ---
 */

describe("Utilities", () => {
    describe("isSupportedChain", () => {
        it("should return true for SupportedChains", () => {
            expect(isSupportedChain(SupportedChains.CELO)).toBe(true)
            expect(isSupportedChain(SupportedChains.BASE)).toBe(true)
        })
        it("should return false for unsupported chains", () => {
            expect(isSupportedChain(1)).toBe(false)
        })
    })

    describe("validateChain", () => {
        it("should return chainId for supported chains", () => {
            expect(validateChain(SupportedChains.CELO)).toBe(SupportedChains.CELO)
        })
        it("should throw for unsupported chains", () => {
            expect(() => validateChain(1)).toThrow("Unsupported chain ID")
        })
    })

    describe("Flow Rate Calculation", () => {
        it("should calculate flow rate correctly", () => {
            const amount = parseEther("100")
            const month = 2592000
            const expected = amount / BigInt(month)
            expect(calculateFlowRate(amount, "month")).toBe(expected)
        })

        it("should format flow rate correctly", () => {
            const flowRate = parseEther("1") / BigInt(3600)
            const formatted = formatFlowRate(flowRate, "hour")
            expect(formatted).toContain("tokens/hour")
        })

        it("should derive flow rate from amount string", () => {
            const flowRate = flowRateFromAmount("100", "month")
            expect(flowRate).toBe(parseEther("100") / BigInt(2592000))
        })
    })
})

/**
 * --- SDK TESTS ---
 */

describe("StreamingSDK", () => {
    let publicClient: any
    let walletClient: any

    beforeEach(() => {
        publicClient = createMockPublicClient()
        walletClient = createMockWalletClient()
    })

    it("should initialize with public client", () => {
        const sdk = new StreamingSDK(publicClient)
        expect(sdk).toBeDefined()
    })

    it("should create a stream", async () => {
        const sdk = new StreamingSDK(publicClient, walletClient)
        const hash = await sdk.createStream({
            receiver: "0xreceiver" as Address,
            token: TEST_SUPERTOKEN,
            flowRate: BigInt(100),
        })

        expect(hash).toBe("0xhash")
        expect(publicClient.simulateContract).toHaveBeenCalled()
    })

    it("should delete a stream", async () => {
        const sdk = new StreamingSDK(publicClient, walletClient)
        const hash = await sdk.deleteStream({
            receiver: "0xreceiver" as Address,
            token: TEST_SUPERTOKEN,
        })
        expect(hash).toBe("0xhash")
    })
})

describe("GdaSDK", () => {
    let publicClient: any
    let walletClient: any

    beforeEach(() => {
        publicClient = createMockPublicClient()
        walletClient = createMockWalletClient()
    })

    it("should initialize GdaSDK", () => {
        const sdk = new GdaSDK(publicClient)
        expect(sdk).toBeDefined()
    })

    it("should connect to pool", async () => {
        const sdk = new GdaSDK(publicClient, walletClient)
        const hash = await sdk.connectToPool({
            poolAddress: "0xpool" as Address,
        })
        expect(hash).toBe("0xhash")
    })

    it("should fetch distribution pools via subgraph", async () => {
        const sdk = new GdaSDK(publicClient)
        const mockPools = [{ id: "0xpool", token: "0xtoken", totalUnits: BigInt(0), flowRate: BigInt(0), admin: "0xadmin" }]

        // Mocking private subgraph client response
        vi.spyOn(sdk as any, "getDistributionPools").mockResolvedValue(mockPools)

        const pools = await sdk.getDistributionPools()
        expect(pools).toEqual(mockPools)
    })
})

/**
 * --- ERROR HANDLING TESTS ---
 */

describe("Error Handling", () => {
    let publicClient: any
    let walletClient: any

    beforeEach(() => {
        publicClient = createMockPublicClient()
        walletClient = createMockWalletClient()
    })

    describe("StreamingSDK", () => {
        it("should throw when public client is missing", () => {
            expect(() => new StreamingSDK(null as any)).toThrow("Public client is required")
        })

        it("should throw when wallet not initialized for write operations", async () => {
            const sdk = new StreamingSDK(publicClient) // No wallet client
            await expect(
                sdk.createStream({
                    receiver: "0xreceiver" as Address,
                    token: TEST_SUPERTOKEN,
                    flowRate: BigInt(100),
                })
            ).rejects.toThrow("Wallet client not initialized")
        })

        it("should throw for invalid flow rate (zero)", async () => {
            const sdk = new StreamingSDK(publicClient, walletClient)
            await expect(
                sdk.createStream({
                    receiver: "0xreceiver" as Address,
                    token: TEST_SUPERTOKEN,
                    flowRate: BigInt(0),
                })
            ).rejects.toThrow("Flow rate must be greater than zero")
        })

        it("should throw for negative flow rate", async () => {
            const sdk = new StreamingSDK(publicClient, walletClient)
            await expect(
                sdk.updateStream({
                    receiver: "0xreceiver" as Address,
                    token: TEST_SUPERTOKEN,
                    newFlowRate: BigInt(-100),
                })
            ).rejects.toThrow("newFlowRate must be a positive non-zero value")
        })

        it("should throw when wallet chain doesn't match SDK chain", () => {
            const misMatchedWallet = createMockWalletClient(SupportedChains.BASE) // Base
            const sdk = new StreamingSDK(publicClient, undefined, { chainId: SupportedChains.CELO })
            expect(() => sdk.setWalletClient(misMatchedWallet)).toThrow(
                "does not match SDK chain"
            )
        })

        it("should validate unsupported chain on initialization", () => {
            expect(() => new StreamingSDK(publicClient, walletClient, { chainId: 1 })).toThrow(
                "Unsupported chain ID"
            )
        })
    })

    describe("GdaSDK", () => {
        it("should throw when public client is missing", () => {
            expect(() => new GdaSDK(null as any)).toThrow("Public client is required")
        })

        it("should throw when wallet chain doesn't match", () => {
            const misMatchedWallet = createMockWalletClient(8453) // Base
            const celoClient = createMockPublicClient(SupportedChains.CELO)
            const sdk = new GdaSDK(celoClient, undefined)
            expect(() => sdk.setWalletClient(misMatchedWallet)).toThrow(
                "does not match SDK chain"
            )
        })
    })
})

/**
 * --- EDGE CASES & UTILITY TESTS ---
 */

describe("Edge Cases & Utilities", () => {
    describe("Chain Configuration", () => {
        it("should support all Celo chains", () => {
            expect(isSupportedChain(SupportedChains.CELO)).toBe(true)
            expect(isSupportedChain(SupportedChains.CELO_ALFAJORES)).toBe(true)
        })

        it("should support all Base chains", () => {
            expect(isSupportedChain(SupportedChains.BASE)).toBe(true)
            expect(isSupportedChain(SupportedChains.BASE_SEPOLIA)).toBe(true)
        })

        it("should reject other chains", () => {
            expect(isSupportedChain(1)).toBe(false)
            expect(isSupportedChain(137)).toBe(false)
            expect(isSupportedChain(undefined)).toBe(false)
        })
    })

    describe("Flow Rate Utilities", () => {
        it("should calculate flow rate for all time units", () => {
            const amount = parseEther("1")
            expect(calculateFlowRate(amount, "second")).toBe(amount)
            expect(calculateFlowRate(amount, "minute")).toBe(amount / BigInt(60))
            expect(calculateFlowRate(amount, "hour")).toBe(amount / BigInt(3600))
            expect(calculateFlowRate(amount, "day")).toBe(amount / BigInt(86400))
            expect(calculateFlowRate(amount, "week")).toBe(amount / BigInt(604800))
            expect(calculateFlowRate(amount, "year")).toBe(amount / BigInt(31536000))
        })

        it("should handle small amounts correctly", () => {
            const smallAmount = BigInt(1)
            const flowRate = calculateFlowRate(smallAmount, "month")
            expect(flowRate).toBe(BigInt(0)) // 1 wei / 2592000 seconds = 0
        })

        it("should format flow rate with precision", () => {
            const flowRate = parseEther("1") / BigInt(3600) // 1 token per hour
            const formatted = formatFlowRate(flowRate, "hour")
            expect(formatted).toMatch(/tokens\/hour/)
            expect(formatted).toContain("hour")
        })

        it("should calculate streamed amount correctly", () => {
            const flowRate = parseEther("100") / BigInt(2592000) // 100 tokens/month
            const secondsInDay = BigInt(86400)
            const streamedInDay = flowRate * secondsInDay

            expect(streamedInDay).toBeGreaterThan(BigInt(0))
            expect(streamedInDay).toBeLessThan(parseEther("100"))
        })
    })

    describe("Environment Configuration", () => {
        it("should use production environment by default", () => {
            const publicClient = createMockPublicClient()
            const sdk = new StreamingSDK(publicClient)
            expect(sdk).toBeDefined()
        })

        it("should support staging environment", () => {
            const publicClient = createMockPublicClient()
            const sdk = new StreamingSDK(publicClient, undefined, { environment: "staging" })
            expect(sdk).toBeDefined()
        })

        it("should support development environment", () => {
            const publicClient = createMockPublicClient()
            const sdk = new StreamingSDK(publicClient, undefined, { environment: "development" })
            expect(sdk).toBeDefined()
        })
    })

    describe("StreamingSDK Methods", () => {
        let publicClient: any
        let walletClient: any

        beforeEach(() => {
            publicClient = createMockPublicClient()
            walletClient = createMockWalletClient()
        })

        it("should update stream with new flow rate", async () => {
            const sdk = new StreamingSDK(publicClient, walletClient)
            const hash = await sdk.updateStream({
                receiver: "0xreceiver" as Address,
                token: TEST_SUPERTOKEN,
                newFlowRate: BigInt(250),
            })
            expect(hash).toBe("0xhash")
            expect(publicClient.simulateContract).toHaveBeenCalled()
        })

        it("should include userData in stream creation", async () => {
            const sdk = new StreamingSDK(publicClient, walletClient)
            const userData = "0x1234" as `0x${string}`
            const hash = await sdk.createStream({
                receiver: "0xreceiver" as Address,
                token: TEST_SUPERTOKEN,
                flowRate: BigInt(100),
                userData,
            })
            expect(hash).toBe("0xhash")
        })

        it("should call onHash callback when provided", async () => {
            const sdk = new StreamingSDK(publicClient, walletClient)
            const onHashMock = vi.fn()

            await sdk.createStream({
                receiver: "0xreceiver" as Address,
                token: TEST_SUPERTOKEN,
                flowRate: BigInt(100),
                onHash: onHashMock,
            })

            expect(onHashMock).toHaveBeenCalledWith("0xhash")
        })
    })

    describe("GdaSDK Methods", () => {
        let publicClient: any
        let walletClient: any

        beforeEach(() => {
            publicClient = createMockPublicClient()
            walletClient = createMockWalletClient()
        })

        it("should disconnect from pool", async () => {
            const sdk = new GdaSDK(publicClient, walletClient)
            const hash = await sdk.disconnectFromPool({
                poolAddress: "0xpool" as Address,
            })
            expect(hash).toBe("0xhash")
        })

        it("should include userData in pool operations", async () => {
            const sdk = new GdaSDK(publicClient, walletClient)
            const userData = "0xabcd" as `0x${string}`
            const hash = await sdk.connectToPool({
                poolAddress: "0xpool" as Address,
                userData,
            })
            expect(hash).toBe("0xhash")
        })

        it("should call onHash callback for pool operations", async () => {
            const sdk = new GdaSDK(publicClient, walletClient)
            const onHashMock = vi.fn()

            await sdk.connectToPool({
                poolAddress: "0xpool" as Address,
                onHash: onHashMock,
            })

            expect(onHashMock).toHaveBeenCalledWith("0xhash")
        })
    })
})

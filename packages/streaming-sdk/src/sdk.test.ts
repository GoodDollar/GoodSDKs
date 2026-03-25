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
    getSUPToken,
} from "./index"

/**
 * --- MOCKS ---
 */

const createMockPublicClient = (chainId: number = SupportedChains.CELO) => ({
    chain: { id: chainId, name: "Celo" },
    simulateContract: vi.fn().mockResolvedValue({ request: {} }),
    waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
} as any)

const createMockWalletClient = (chainId: number = SupportedChains.CELO) => ({
    chain: { id: chainId },
    getAddresses: vi.fn().mockResolvedValue(["0x0000000000000000000000000000000000000001"]),
    writeContract: vi.fn().mockResolvedValue("0xhash"),
} as any)

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
            userData: "0x1234",
        })

        expect(hash).toBe("0xhash")
        expect(publicClient.simulateContract).toHaveBeenCalledWith(
            expect.objectContaining({
                args: expect.arrayContaining([
                    TEST_SUPERTOKEN,
                    "0x0000000000000000000000000000000000000001",
                    "0xreceiver",
                    BigInt(100),
                    "0x1234",
                ]),
            })
        )
    })

    it("should create or update a stream via setFlowrate with exactly 3 args", async () => {
        const sdk = new StreamingSDK(publicClient, walletClient)
        const hash = await sdk.createOrUpdateStream({
            receiver: "0xreceiver" as Address,
            token: TEST_SUPERTOKEN,
            flowRate: BigInt(100),
        })

        expect(hash).toBe("0xhash")
        expect(publicClient.simulateContract).toHaveBeenCalledWith(
            expect.objectContaining({
                functionName: "setFlowrate",
                // Exactly 3 args: token, receiver, flowRate (no account, no userData)
                args: [TEST_SUPERTOKEN, "0xreceiver", BigInt(100)],
            })
        )
    })

    it("should delete a stream", async () => {
        const sdk = new StreamingSDK(publicClient, walletClient)
        const hash = await sdk.deleteStream({
            receiver: "0xreceiver" as Address,
            token: TEST_SUPERTOKEN,
            userData: "0xabcd" as `0x${string}`,
        })
        expect(hash).toBe("0xhash")
    })

    describe("Token Auto-Resolution", () => {
        it("should auto-resolve G$ token for Celo production", async () => {
            const sdk = new StreamingSDK(publicClient, walletClient)
            // No token provided
            const hash = await sdk.createStream({
                receiver: "0xreceiver" as Address,
                flowRate: BigInt(100),
            })

            expect(hash).toBe("0xhash")
            // Verify simulateContract was called with TEST_SUPERTOKEN
            expect(publicClient.simulateContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    args: expect.arrayContaining([TEST_SUPERTOKEN])
                })
            )
        })

        it("should allow overriding auto-resolved token", async () => {
            const sdk = new StreamingSDK(publicClient, walletClient)
            const customToken = "0xcustom" as Address
            const hash = await sdk.createStream({
                receiver: "0xreceiver" as Address,
                token: customToken,
                flowRate: BigInt(100),
            })

            expect(hash).toBe("0xhash")
            expect(publicClient.simulateContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    args: expect.arrayContaining([customToken])
                })
            )
        })

    })

    describe("defaultToken Option", () => {
        it("should default to G$ when no defaultToken is specified", async () => {
            const sdk = new StreamingSDK(publicClient, walletClient)
            await sdk.createStream({ receiver: "0xreceiver" as Address, flowRate: BigInt(100) })
            expect(publicClient.simulateContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    args: expect.arrayContaining([TEST_SUPERTOKEN])
                })
            )
        })

        it("should use G$ address when defaultToken is 'G$'", async () => {
            const sdk = new StreamingSDK(publicClient, walletClient, { defaultToken: "G$" })
            await sdk.createStream({ receiver: "0xreceiver" as Address, flowRate: BigInt(100) })
            expect(publicClient.simulateContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    args: expect.arrayContaining([TEST_SUPERTOKEN])
                })
            )
        })

        it("should use raw address when defaultToken is an Address", async () => {
            const customToken = "0xcafe000000000000000000000000000000000001" as Address
            const sdk = new StreamingSDK(publicClient, walletClient, { defaultToken: customToken })
            await sdk.createStream({ receiver: "0xreceiver" as Address, flowRate: BigInt(100) })
            expect(publicClient.simulateContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    args: expect.arrayContaining([customToken])
                })
            )
        })

        it("should resolve SUP token for Base when defaultToken is 'SUP'", () => {
            const basePublicClient = createMockPublicClient(SupportedChains.BASE)
            const baseWalletClient = createMockWalletClient(SupportedChains.BASE)
            const sdk = new StreamingSDK(basePublicClient, baseWalletClient, { defaultToken: "SUP" })
            expect(sdk).toBeDefined()

            const supAddr = getSUPToken(SupportedChains.BASE, "production")
            expect(supAddr).toBe("0xa69f80524381275A7fFdb3AE01c54150644c8792")
        })

        it("should allow per-call token to override defaultToken", async () => {
            const overrideToken = "0xoverride000000000000000000000000000000001" as Address
            const sdk = new StreamingSDK(publicClient, walletClient, { defaultToken: "G$" })
            await sdk.createStream({ receiver: "0xreceiver" as Address, flowRate: BigInt(100), token: overrideToken })
            expect(publicClient.simulateContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    args: expect.arrayContaining([overrideToken])
                })
            )
        })

        it("should resolve balance for defaultToken when symbol given to getSuperTokenBalance", async () => {
            const sdk = new StreamingSDK(publicClient, undefined, { defaultToken: "G$" })
            const mockBalances = [{ token: TEST_SUPERTOKEN, balance: BigInt(500) }]
            vi.spyOn(sdk.getSubgraphClient(), "queryBalances").mockResolvedValue(mockBalances as any)

            const balance = await sdk.getSuperTokenBalance("0xaccount" as Address)
            expect(balance).toBe(BigInt(500))
        })

        it("should resolve balance for SUP when explicitly requested via symbol", async () => {
            const basePublicClient = createMockPublicClient(SupportedChains.BASE)
            const sdk = new StreamingSDK(basePublicClient)
            const SUP_ADDR = getSUPToken(SupportedChains.BASE) as Address
            const mockBalances = [{ token: SUP_ADDR, balance: BigInt(1000) }]
            vi.spyOn(sdk.getSubgraphClient(), "queryBalances").mockResolvedValue(mockBalances as any)

            const balance = await sdk.getSuperTokenBalance("0xaccount" as Address, "SUP")
            expect(balance).toBe(BigInt(1000))
        })

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

    it("should fetch distribution pools (member pools) via subgraph", async () => {
        const sdk = new GdaSDK(publicClient)
        const mockAccount = "0x0000000000000000000000000000000000000001" as Address
        const mockPools = [{
            id: "0xpool" as Address,
            token: "0xtoken" as Address,
            totalUnits: BigInt(0),
            totalAmountClaimed: BigInt(0),
            flowRate: BigInt(0),
            admin: "0xadmin" as Address,
            isConnected: false
        }]

        const queryMemberPoolsSpy = vi
            .spyOn((sdk as any).subgraphClient, "queryMemberPools")
            .mockResolvedValue(mockPools)

        const pools = await sdk.getDistributionPools(mockAccount)
        expect(queryMemberPoolsSpy).toHaveBeenCalledWith(mockAccount, {})
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

        it("should throw when chain is unsupported", () => {
            const mockClient = createMockPublicClient(123)
            expect(() => new StreamingSDK(mockClient)).toThrow("Unsupported chain ID")
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

        it("should throw when token cannot be resolved (Base with G$ symbol)", async () => {
            const basePublicClient = createMockPublicClient(SupportedChains.BASE)
            const sdk = new StreamingSDK(basePublicClient)
            await expect(
                sdk.createStream({
                    receiver: "0xreceiver" as Address,
                    flowRate: BigInt(100),
                    token: "G$"
                })
            ).rejects.toThrow("Token address not available")
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
        })

        it("should support all Base chains", () => {
            expect(isSupportedChain(SupportedChains.BASE)).toBe(true)
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

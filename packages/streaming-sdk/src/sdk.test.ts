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

const TEST_SUPERTOKEN = "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as Address

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

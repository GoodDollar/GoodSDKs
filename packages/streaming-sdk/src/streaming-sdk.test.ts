import { describe, it, expect, vi, beforeEach } from "vitest"
import { StreamingSDK } from "./streaming-sdk"
import { SupportedChains } from "./constants"
import type { Address, PublicClient, WalletClient } from "viem"

// Mock clients
const createMockPublicClient = (chainId: number = 42220): PublicClient => {
    return {
        chain: { id: chainId },
        simulateContract: vi.fn().mockResolvedValue({ request: {} }),
        waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
    } as any
}

const createMockWalletClient = (chainId: number = 42220): WalletClient => {
    return {
        chain: { id: chainId },
        writeContract: vi.fn().mockResolvedValue("0xtxhash" as Address),
        getAddresses: vi
            .fn()
            .mockResolvedValue([
                "0x1234567890123456789012345678901234567890" as Address,
            ]),
    } as any
}

describe("StreamingSDK", () => {
    let publicClient: PublicClient
    let walletClient: WalletClient

    beforeEach(() => {
        publicClient = createMockPublicClient()
        walletClient = createMockWalletClient()
    })

    describe("Constructor", () => {
        it("should initialize with valid clients", () => {
            const sdk = new StreamingSDK(publicClient, walletClient, {
                chainId: SupportedChains.CELO,
                environment: "production",
            })

            expect(sdk).toBeDefined()
            expect(sdk.getSubgraphClient()).toBeDefined()
        })

        it("should throw error without public client", () => {
            expect(() => {
                new StreamingSDK(null as any)
            }).toThrow("Public client is required")
        })

        it("should validate chain ID", () => {
            const invalidPublicClient = createMockPublicClient(1) // Ethereum

            expect(() => {
                new StreamingSDK(invalidPublicClient, undefined, {
                    chainId: 1,
                })
            }).toThrow("Unsupported chain")
        })

        it("should default to production environment", () => {
            const sdk = new StreamingSDK(publicClient)
            expect(sdk).toBeDefined()
        })

        it("should work without wallet client", () => {
            const sdk = new StreamingSDK(publicClient)
            expect(sdk).toBeDefined()
        })

        it("should accept Base chain ID", () => {
            const baseClient = createMockPublicClient(8453)
            const sdk = new StreamingSDK(baseClient, undefined, {
                chainId: SupportedChains.BASE,
            })
            expect(sdk).toBeDefined()
        })
    })

    describe("setWalletClient", () => {
        it("should set wallet client with matching chain", () => {
            const sdk = new StreamingSDK(publicClient)

            expect(() => {
                sdk.setWalletClient(walletClient)
            }).not.toThrow()
        })

        it("should throw error for mismatched chains", () => {
            const sdk = new StreamingSDK(publicClient, undefined, {
                chainId: SupportedChains.CELO,
            })

            const baseWalletClient = createMockWalletClient(SupportedChains.BASE)

            expect(() => {
                sdk.setWalletClient(baseWalletClient)
            }).toThrow("does not match SDK chain")
        })
    })

    describe("createStream", () => {
        it("should throw error for zero flow rate", async () => {
            const sdk = new StreamingSDK(publicClient, walletClient)

            await expect(
                sdk.createStream({
                    receiver:
                        "0x1234567890123456789012345678901234567890" as Address,
                    token: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as Address,
                    flowRate: BigInt(0),
                }),
            ).rejects.toThrow("Flow rate must be greater than zero")
        })

        it("should throw error for negative flow rate", async () => {
            const sdk = new StreamingSDK(publicClient, walletClient)

            await expect(
                sdk.createStream({
                    receiver:
                        "0x1234567890123456789012345678901234567890" as Address,
                    token: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as Address,
                    flowRate: BigInt(-1000),
                }),
            ).rejects.toThrow("Flow rate must be greater than zero")
        })

        it("should throw error without wallet client", async () => {
            const sdk = new StreamingSDK(publicClient)

            await expect(
                sdk.createStream({
                    receiver:
                        "0x1234567890123456789012345678901234567890" as Address,
                    token: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as Address,
                    flowRate: BigInt(1000),
                }),
            ).rejects.toThrow("Wallet client not initialized")
        })

        it("should call onHash callback when provided", async () => {
            const sdk = new StreamingSDK(publicClient, walletClient)
            const onHashMock = vi.fn()

            await sdk.createStream({
                receiver: "0x1234567890123456789012345678901234567890" as Address,
                token: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as Address,
                flowRate: BigInt(1000),
                onHash: onHashMock,
            })

            expect(onHashMock).toHaveBeenCalledWith("0xtxhash")
        })
    })

    describe("updateStream", () => {
        it("should throw error without wallet client", async () => {
            const sdk = new StreamingSDK(publicClient)

            await expect(
                sdk.updateStream({
                    receiver:
                        "0x1234567890123456789012345678901234567890" as Address,
                    token: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as Address,
                    newFlowRate: BigInt(2000),
                }),
            ).rejects.toThrow("Wallet client not initialized")
        })
    })

    describe("deleteStream", () => {
        it("should throw error without wallet client", async () => {
            const sdk = new StreamingSDK(publicClient)

            await expect(
                sdk.deleteStream({
                    receiver:
                        "0x1234567890123456789012345678901234567890" as Address,
                    token: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as Address,
                }),
            ).rejects.toThrow("Wallet client not initialized")
        })
    })

    describe("getActiveStreams", () => {
        it("should return empty array when no streams exist", async () => {
            const sdk = new StreamingSDK(publicClient)

            // Mock subgraph client
            const mockQueryStreams = vi.fn().mockResolvedValue([])
            sdk.getSubgraphClient().queryStreams = mockQueryStreams

            const streams = await sdk.getActiveStreams(
                "0x1234567890123456789012345678901234567890" as Address,
            )

            expect(mockQueryStreams).toHaveBeenCalledWith({
                account: "0x1234567890123456789012345678901234567890" as Address,
                direction: "all",
            })
            expect(streams).toEqual([])
        })

        it("should filter by direction", async () => {
            const sdk = new StreamingSDK(publicClient)

            const mockQueryStreams = vi.fn().mockResolvedValue([])
            sdk.getSubgraphClient().queryStreams = mockQueryStreams

            await sdk.getActiveStreams(
                "0x1234567890123456789012345678901234567890" as Address,
                "incoming",
            )

            expect(mockQueryStreams).toHaveBeenCalledWith({
                account: "0x1234567890123456789012345678901234567890" as Address,
                direction: "incoming",
            })
        })

        it("should transform subgraph results to StreamInfo", async () => {
            const sdk = new StreamingSDK(publicClient)

            const mockSubgraphResult = [
                {
                    id: "stream-1",
                    sender: "0xsender" as Address,
                    receiver: "0xreceiver" as Address,
                    token: "0xtoken" as Address,
                    currentFlowRate: BigInt(1000),
                    streamedUntilUpdatedAt: BigInt(5000),
                    updatedAtTimestamp: 1234567890,
                    createdAtTimestamp: 1234567800,
                },
            ]

            const mockQueryStreams = vi
                .fn()
                .mockResolvedValue(mockSubgraphResult)
            sdk.getSubgraphClient().queryStreams = mockQueryStreams

            const streams = await sdk.getActiveStreams(
                "0x1234567890123456789012345678901234567890" as Address,
            )

            expect(streams).toHaveLength(1)
            expect(streams[0]).toEqual({
                sender: "0xsender",
                receiver: "0xreceiver",
                token: "0xtoken",
                flowRate: BigInt(1000),
                timestamp: BigInt(1234567800),
                streamedSoFar: BigInt(5000),
            })
        })
    })

    describe("getSuperTokenBalance", () => {
        it("should return balance for account", async () => {
            const sdk = new StreamingSDK(publicClient, undefined, {
                environment: "production",
            })

            const mockQueryBalances = vi.fn().mockResolvedValue([
                {
                    token: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A",
                    balance: BigInt("100000000000000000000"), // 100 tokens
                },
            ])
            sdk.getSubgraphClient().queryBalances = mockQueryBalances

            const balance = await sdk.getSuperTokenBalance(
                "0x1234567890123456789012345678901234567890" as Address,
            )

            expect(balance).toEqual(BigInt("100000000000000000000"))
        })

        it("should return zero for non-existent account", async () => {
            const sdk = new StreamingSDK(publicClient)

            const mockQueryBalances = vi.fn().mockResolvedValue([])
            sdk.getSubgraphClient().queryBalances = mockQueryBalances

            const balance = await sdk.getSuperTokenBalance(
                "0x1234567890123456789012345678901234567890" as Address,
            )

            expect(balance).toEqual(BigInt(0))
        })

        it("should return zero when token not found in balances", async () => {
            const sdk = new StreamingSDK(publicClient, undefined, {
                environment: "production",
            })

            const mockQueryBalances = vi.fn().mockResolvedValue([
                {
                    token: "0xdifferenttoken",
                    balance: BigInt("100000000000000000000"),
                },
            ])
            sdk.getSubgraphClient().queryBalances = mockQueryBalances

            const balance = await sdk.getSuperTokenBalance(
                "0x1234567890123456789012345678901234567890" as Address,
            )

            expect(balance).toEqual(BigInt(0))
        })
    })

    describe("getBalanceHistory", () => {
        it("should query balance history with time range", async () => {
            const sdk = new StreamingSDK(publicClient)

            const mockQueryBalanceHistory = vi.fn().mockResolvedValue([])
            sdk.getSubgraphClient().queryBalanceHistory =
                mockQueryBalanceHistory

            const fromTimestamp = Date.now() - 30 * 24 * 60 * 60 * 1000
            const toTimestamp = Date.now()

            await sdk.getBalanceHistory(
                "0x1234567890123456789012345678901234567890" as Address,
                fromTimestamp,
                toTimestamp,
            )

            expect(mockQueryBalanceHistory).toHaveBeenCalledWith({
                account: "0x1234567890123456789012345678901234567890" as Address,
                fromTimestamp,
                toTimestamp,
            })
        })

        it("should query balance history without time range", async () => {
            const sdk = new StreamingSDK(publicClient)

            const mockQueryBalanceHistory = vi.fn().mockResolvedValue([])
            sdk.getSubgraphClient().queryBalanceHistory =
                mockQueryBalanceHistory

            await sdk.getBalanceHistory(
                "0x1234567890123456789012345678901234567890" as Address,
            )

            expect(mockQueryBalanceHistory).toHaveBeenCalledWith({
                account: "0x1234567890123456789012345678901234567890" as Address,
                fromTimestamp: undefined,
                toTimestamp: undefined,
            })
        })
    })

    describe("getSubgraphClient", () => {
        it("should return subgraph client instance", () => {
            const sdk = new StreamingSDK(publicClient)

            const client = sdk.getSubgraphClient()

            expect(client).toBeDefined()
        })
    })
})

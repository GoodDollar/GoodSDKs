import { describe, it, expect, vi, beforeEach } from "vitest"
import { GdaSDK } from "./gda-sdk"
import { SupportedChains } from "./constants"
import type { Address, PublicClient, WalletClient } from "viem"

// Mock clients
const createMockPublicClient = (chainId: number = 42220): PublicClient => {
    return {
        chain: { id: chainId },
        simulateContract: vi.fn().mockResolvedValue({ request: {} }),
        waitForTransactionReceipt: vi
            .fn()
            .mockResolvedValue({ status: "success" }),
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

describe("GdaSDK", () => {
    let publicClient: PublicClient
    let walletClient: WalletClient

    beforeEach(() => {
        publicClient = createMockPublicClient()
        walletClient = createMockWalletClient()
    })

    describe("Constructor", () => {
        it("should initialize with valid clients", () => {
            const sdk = new GdaSDK(publicClient, walletClient, SupportedChains.CELO)

            expect(sdk).toBeDefined()
        })

        it("should throw error without public client", () => {
            expect(() => {
                new GdaSDK(null as any)
            }).toThrow("Public client is required")
        })

        it("should validate chain ID", () => {
            const invalidPublicClient = createMockPublicClient(1) // Ethereum

            expect(() => {
                new GdaSDK(invalidPublicClient, undefined, 1)
            }).toThrow("Unsupported chain")
        })

        it("should work without wallet client", () => {
            const sdk = new GdaSDK(publicClient)
            expect(sdk).toBeDefined()
        })
    })

    describe("setWalletClient", () => {
        it("should set wallet client with matching chain", () => {
            const sdk = new GdaSDK(publicClient)

            expect(() => {
                sdk.setWalletClient(walletClient)
            }).not.toThrow()
        })

        it("should throw error for mismatched chains", () => {
            const sdk = new GdaSDK(publicClient, undefined, SupportedChains.CELO)

            const baseWalletClient = createMockWalletClient(SupportedChains.BASE)

            expect(() => {
                sdk.setWalletClient(baseWalletClient)
            }).toThrow("does not match SDK chain")
        })
    })

    describe("connectToPool", () => {
        it("should throw error without wallet client", async () => {
            const sdk = new GdaSDK(publicClient)

            await expect(
                sdk.connectToPool({
                    poolAddress: "0xpool1" as Address,
                }),
            ).rejects.toThrow("Wallet client not initialized")
        })

        it("should call onHash callback when provided", async () => {
            const sdk = new GdaSDK(publicClient, walletClient)
            const onHashMock = vi.fn()

            await sdk.connectToPool({
                poolAddress: "0xpool1" as Address,
                onHash: onHashMock,
            })

            expect(onHashMock).toHaveBeenCalledWith("0xtxhash")
        })
    })

    describe("disconnectFromPool", () => {
        it("should throw error without wallet client", async () => {
            const sdk = new GdaSDK(publicClient)

            await expect(
                sdk.disconnectFromPool({
                    poolAddress: "0xpool1" as Address,
                }),
            ).rejects.toThrow("Wallet client not initialized")
        })
    })

    describe("getDistributionPools", () => {
        it("should return pools from subgraph", async () => {
            const sdk = new GdaSDK(publicClient, undefined, SupportedChains.CELO)

            const mockPools = [
                {
                    id: "0xpool1" as Address,
                    token: "0xtoken1" as Address,
                    totalUnits: BigInt(1000),
                    totalAmountClaimed: BigInt(500),
                    flowRate: BigInt(10),
                    admin: "0xadmin" as Address,
                },
            ]

            const mockQueryPools = vi.fn().mockResolvedValue(mockPools)
            sdk["subgraphClient"].queryPools = mockQueryPools

            const pools = await sdk.getDistributionPools()

            expect(pools).toEqual(mockPools)
            expect(mockQueryPools).toHaveBeenCalled()
        })

        it("should return empty array when no pools exist", async () => {
            const sdk = new GdaSDK(publicClient)

            const mockQueryPools = vi.fn().mockResolvedValue([])
            sdk["subgraphClient"].queryPools = mockQueryPools

            const pools = await sdk.getDistributionPools()

            expect(pools).toEqual([])
        })
    })

    describe("getPoolMemberships", () => {
        it("should return memberships for account", async () => {
            const sdk = new GdaSDK(publicClient)

            const mockMemberships = [
                {
                    pool: "0xpool1" as Address,
                    account: "0xaccount1" as Address,
                    units: BigInt(100),
                    isConnected: true,
                    totalAmountClaimed: BigInt(50),
                },
            ]

            const mockQueryPoolMemberships = vi
                .fn()
                .mockResolvedValue(mockMemberships)
            sdk["subgraphClient"].queryPoolMemberships = mockQueryPoolMemberships

            const memberships = await sdk.getPoolMemberships(
                "0xaccount1" as Address,
            )

            expect(memberships).toEqual(mockMemberships)
            expect(mockQueryPoolMemberships).toHaveBeenCalledWith(
                "0xaccount1" as Address,
            )
        })

        it("should return empty array when no memberships exist", async () => {
            const sdk = new GdaSDK(publicClient)

            const mockQueryPoolMemberships = vi.fn().mockResolvedValue([])
            sdk["subgraphClient"].queryPoolMemberships = mockQueryPoolMemberships

            const memberships = await sdk.getPoolMemberships(
                "0xaccount1" as Address,
            )

            expect(memberships).toEqual([])
        })
    })

    describe("getPoolDetails", () => {
        it("should return pool by ID", async () => {
            const sdk = new GdaSDK(publicClient)

            const mockPools = [
                {
                    id: "0xpool1" as Address,
                    token: "0xtoken1" as Address,
                    totalUnits: BigInt(1000),
                    totalAmountClaimed: BigInt(500),
                    flowRate: BigInt(10),
                    admin: "0xadmin" as Address,
                },
                {
                    id: "0xpool2" as Address,
                    token: "0xtoken2" as Address,
                    totalUnits: BigInt(2000),
                    totalAmountClaimed: BigInt(1000),
                    flowRate: BigInt(20),
                    admin: "0xadmin2" as Address,
                },
            ]

            vi.spyOn(sdk, "getDistributionPools").mockResolvedValue(mockPools)

            const pool = await sdk.getPoolDetails("0xpool1" as Address)

            expect(pool).toEqual(mockPools[0])
        })

        it("should return null for non-existent pool", async () => {
            const sdk = new GdaSDK(publicClient)

            vi.spyOn(sdk, "getDistributionPools").mockResolvedValue([])

            const pool = await sdk.getPoolDetails("0xnonexistent" as Address)

            expect(pool).toBeNull()
        })

        it("should handle case-insensitive pool ID matching", async () => {
            const sdk = new GdaSDK(publicClient)

            const mockPools = [
                {
                    id: "0xABCDEF" as Address,
                    token: "0xtoken1" as Address,
                    totalUnits: BigInt(1000),
                    totalAmountClaimed: BigInt(500),
                    flowRate: BigInt(10),
                    admin: "0xadmin" as Address,
                },
            ]

            vi.spyOn(sdk, "getDistributionPools").mockResolvedValue(mockPools)

            const pool = await sdk.getPoolDetails("0xabcdef" as Address)

            expect(pool).toEqual(mockPools[0])
        })
    })
})

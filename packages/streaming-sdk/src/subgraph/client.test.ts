import { describe, it, expect, vi, beforeEach } from "vitest"
import { Address } from "viem"
import { GraphQLClient } from "graphql-request"
import { SubgraphClient } from "./client"
import { SupportedChains } from "../constants"

// Mock the graphql-request module
vi.mock("graphql-request", () => {
  const requestMock = vi.fn()
  return {
    GraphQLClient: vi.fn().mockImplementation(function() {
      return { request: requestMock }
    }),
    gql: (strs: TemplateStringsArray) => strs.join(""),
  }
})

describe("SubgraphClient", () => {
  let client: SubgraphClient
  let requestMock: any

  beforeEach(() => {
    vi.clearAllMocks()
    client = new SubgraphClient(SupportedChains.BASE, { apiKey: "test-api-key" })
    const GraphQLClientMock = vi.mocked(GraphQLClient)
    requestMock = GraphQLClientMock.mock.results[0].value.request
  })

  describe("queryMemberPools", () => {
    it("should correctly map isConnected and totalAmountClaimed from poolMembers", async () => {
      const mockAccount = "0xUser" as Address
      
      requestMock.mockResolvedValue({
        pools: [
          {
            id: "0xPool",
            token: { id: "0xToken", symbol: "SUP" },
            totalUnits: "1000",
            totalAmountDistributedUntilUpdatedAt: "99999", // This should NOT be mapped to totalAmountClaimed
            flowRate: "100",
            admin: { id: "0xAdmin" },
            poolMembers: [
              {
                isConnected: true,
                units: "500",
                totalAmountClaimed: "42", // This SHOULD be mapped
              }
            ]
          }
        ]
      })

      const pools = await client.queryMemberPools(mockAccount)

      expect(requestMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ account: mockAccount.toLowerCase() })
      )

      expect(pools).toHaveLength(1)
      const pool = pools[0]
      expect(pool.id).toBe("0xPool")
      expect(pool.isConnected).toBe(true)
      expect(pool.totalAmountClaimed).toBe(BigInt(42)) // Verifies rule #4 fix
      expect(pool.totalAmountClaimed).not.toBe(BigInt(99999))
    })

    it("should handle pools where member is disconnected (or poolMembers is empty/missing)", async () => {
      const mockAccount = "0xUser" as Address
      
      requestMock.mockResolvedValue({
        pools: [
          {
            id: "0xPool",
            token: { id: "0xToken", symbol: "SUP" },
            totalUnits: "1000",
            totalAmountDistributedUntilUpdatedAt: "99999",
            flowRate: "100",
            admin: { id: "0xAdmin" },
            poolMembers: [] // Missing member data
          }
        ]
      })

      const pools = await client.queryMemberPools(mockAccount)

      expect(pools).toHaveLength(1)
      const pool = pools[0]
      expect(pool.isConnected).toBe(false)
      expect(pool.totalAmountClaimed).toBe(BigInt(0))
    })

    it("should return empty array if account is falsy", async () => {
      const pools = await client.queryMemberPools("" as Address)
      expect(pools).toEqual([])
      expect(requestMock).not.toHaveBeenCalled()
    })
  })

  describe("querySUPReserves", () => {
    it("should correctly map locker data", async () => {
      const mockAccount = "0xUser" as Address

      requestMock.mockResolvedValue({
        lockers: [
          {
            id: "0xLocker",
            lockerOwner: { id: "0xUser" },
            blockNumber: "12345",
            blockTimestamp: "67890"
          }
        ]
      })

      const lockers = await client.querySUPReserves(mockAccount)

      expect(requestMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ account: mockAccount.toLowerCase() })
      )

      expect(lockers).toHaveLength(1)
      const locker = lockers[0]
      expect(locker.id).toBe("0xLocker")
      expect(locker.lockerOwner).toBe("0xUser")
      expect(locker.blockNumber).toBe(BigInt(12345))
      expect(locker.blockTimestamp).toBe(BigInt(67890))
    })

    it("should throw if account is missing", async () => {
      await expect(client.querySUPReserves("" as Address)).rejects.toThrow("account is required to fetch SUP reserves")
    })

    it("should throw if apiKey is missing", async () => {
      const noApiKeyClient = new SubgraphClient(SupportedChains.BASE) // No apiKey passed
      await expect(noApiKeyClient.querySUPReserves("0xUser" as Address)).rejects.toThrow(
        "Missing apiKey for SUP reserves subgraph (The Graph Gateway)."
      )
    })
  })
})

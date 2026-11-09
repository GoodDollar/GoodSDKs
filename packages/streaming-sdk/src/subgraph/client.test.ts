import { describe, it, expect, vi, beforeEach } from "vitest"
import { Address } from "viem"
import { GraphQLClient } from "graphql-request"
import { SubgraphClient } from "./client"
import { SupportedChains, SUBGRAPH_URLS } from "../constants"

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

  describe("queryStreams", () => {
    it("should honor first even when skip is omitted", async () => {
      const mockAccount = "0x0000000000000000000000000000000000000001" as Address

      requestMock.mockResolvedValue({
        streams: [
          {
            id: "stream-1",
            sender: { id: mockAccount },
            receiver: { id: "0x0000000000000000000000000000000000000002" },
            token: { id: "0x0000000000000000000000000000000000000003", symbol: "SUP" },
            currentFlowRate: "11",
            streamedUntilUpdatedAt: "22",
            updatedAtTimestamp: "100",
            createdAtTimestamp: "99",
          },
          {
            id: "stream-2",
            sender: { id: mockAccount },
            receiver: { id: "0x0000000000000000000000000000000000000004" },
            token: { id: "0x0000000000000000000000000000000000000003", symbol: "SUP" },
            currentFlowRate: "33",
            streamedUntilUpdatedAt: "44",
            updatedAtTimestamp: "101",
            createdAtTimestamp: "98",
          },
        ],
      })

      const streams = await client.queryStreams({
        account: mockAccount,
        direction: "outgoing",
        first: 2,
      })

      expect(requestMock).toHaveBeenCalledWith(
        expect.stringContaining("sender: $account"),
        expect.objectContaining({
          account: mockAccount.toLowerCase(),
          first: 2,
          skip: 0,
        }),
      )
      expect(streams).toHaveLength(2)
      expect(streams.map((stream) => stream.id)).toEqual(["stream-1", "stream-2"])
    })

    it("should apply combined pagination after merging incoming and outgoing streams", async () => {
      const mockAccount = "0x0000000000000000000000000000000000000001" as Address

      requestMock.mockImplementation((query: string) => {
        if (query.includes("sender: $account")) {
          return Promise.resolve({
            streams: [
              {
                id: "outgoing-newest",
                sender: { id: mockAccount },
                receiver: { id: "0x0000000000000000000000000000000000000002" },
                token: { id: "0x0000000000000000000000000000000000000003", symbol: "SUP" },
                currentFlowRate: "11",
                streamedUntilUpdatedAt: "22",
                updatedAtTimestamp: "301",
                createdAtTimestamp: "300",
              },
              {
                id: "outgoing-oldest",
                sender: { id: mockAccount },
                receiver: { id: "0x0000000000000000000000000000000000000004" },
                token: { id: "0x0000000000000000000000000000000000000003", symbol: "SUP" },
                currentFlowRate: "33",
                streamedUntilUpdatedAt: "44",
                updatedAtTimestamp: "101",
                createdAtTimestamp: "100",
              },
            ],
          })
        }

        return Promise.resolve({
          streams: [
            {
              id: "incoming-middle",
              sender: { id: "0x0000000000000000000000000000000000000005" },
              receiver: { id: mockAccount },
              token: { id: "0x0000000000000000000000000000000000000003", symbol: "SUP" },
              currentFlowRate: "55",
              streamedUntilUpdatedAt: "66",
              updatedAtTimestamp: "201",
              createdAtTimestamp: "200",
            },
            {
              id: "incoming-oldest",
              sender: { id: "0x0000000000000000000000000000000000000006" },
              receiver: { id: mockAccount },
              token: { id: "0x0000000000000000000000000000000000000003", symbol: "SUP" },
              currentFlowRate: "77",
              streamedUntilUpdatedAt: "88",
              updatedAtTimestamp: "51",
              createdAtTimestamp: "50",
            },
          ],
        })
      })

      const streams = await client.queryStreams({
        account: mockAccount,
        direction: "all",
        first: 2,
        skip: 1,
      })

      expect(streams.map((stream) => stream.id)).toEqual([
        "incoming-middle",
        "outgoing-oldest",
      ])
    })

    const streamRow = (
      account: Address,
      overrides: Record<string, unknown> = {},
    ) => ({
      id: "stream-1",
      sender: { id: account },
      receiver: { id: "0x0000000000000000000000000000000000000002" },
      token: { id: "0x0000000000000000000000000000000000000003", symbol: "G$" },
      currentFlowRate: "11",
      streamedUntilUpdatedAt: "22",
      updatedAtTimestamp: "100",
      createdAtTimestamp: "99",
      ...overrides,
    })

    it("should filter to running streams by default", async () => {
      const mockAccount = "0x0000000000000000000000000000000000000001" as Address
      requestMock.mockResolvedValue({ streams: [] })

      await client.queryStreams({ account: mockAccount, direction: "outgoing" })

      expect(requestMock).toHaveBeenCalledWith(
        expect.stringContaining('currentFlowRate_gt: "0"'),
        expect.anything(),
      )
    })

    it("should query only closed streams for status ended", async () => {
      const mockAccount = "0x0000000000000000000000000000000000000001" as Address
      requestMock.mockResolvedValue({ streams: [] })

      await client.queryStreams({
        account: mockAccount,
        direction: "outgoing",
        status: "ended",
      })

      const query = requestMock.mock.calls[0][0]
      expect(query).toContain('currentFlowRate: "0"')
      expect(query).not.toContain("currentFlowRate_gt")
    })

    it("should drop the flow-rate filter entirely for status all", async () => {
      const mockAccount = "0x0000000000000000000000000000000000000001" as Address
      requestMock.mockResolvedValue({ streams: [] })

      await client.queryStreams({
        account: mockAccount,
        direction: "outgoing",
        status: "all",
      })

      const query = requestMock.mock.calls[0][0]
      expect(query).toContain("where: { sender: $account }")
      expect(query).not.toContain("currentFlowRate_gt")
    })

    it("should map token symbol and mark running streams active", async () => {
      const mockAccount = "0x0000000000000000000000000000000000000001" as Address
      requestMock.mockResolvedValue({ streams: [streamRow(mockAccount)] })

      const [stream] = await client.queryStreams({
        account: mockAccount,
        direction: "outgoing",
      })

      expect(stream.tokenSymbol).toBe("G$")
      expect(stream.isActive).toBe(true)
      expect(stream.closedAtTimestamp).toBeUndefined()
      expect(stream.lastFlowRate).toBe(BigInt(11))
    })

    it("should mark zero-rate streams ended and expose the close time", async () => {
      const mockAccount = "0x0000000000000000000000000000000000000001" as Address
      requestMock.mockResolvedValue({
        streams: [streamRow(mockAccount, { currentFlowRate: "0" })],
      })

      const [stream] = await client.queryStreams({
        account: mockAccount,
        direction: "outgoing",
        status: "all",
      })

      expect(stream.isActive).toBe(false)
      expect(stream.closedAtTimestamp).toBe(100)
      expect(stream.lastFlowRate).toBeUndefined()
    })

    it("should read the historical rate of a closed stream when requested", async () => {
      const mockAccount = "0x0000000000000000000000000000000000000001" as Address
      requestMock.mockResolvedValue({
        streams: [
          streamRow(mockAccount, {
            currentFlowRate: "0",
            streamPeriods: [{ flowRate: "4200" }],
          }),
        ],
      })

      const [stream] = await client.queryStreams({
        account: mockAccount,
        direction: "outgoing",
        status: "ended",
        includeLastFlowRate: true,
      })

      expect(requestMock).toHaveBeenCalledWith(
        expect.stringContaining("streamPeriods"),
        expect.anything(),
      )
      expect(stream.currentFlowRate).toBe(BigInt(0))
      expect(stream.lastFlowRate).toBe(BigInt(4200))
    })

    it("should not request stream periods unless asked", async () => {
      const mockAccount = "0x0000000000000000000000000000000000000001" as Address
      requestMock.mockResolvedValue({ streams: [] })

      await client.queryStreams({ account: mockAccount, direction: "outgoing" })

      expect(requestMock.mock.calls[0][0]).not.toContain("streamPeriods")
    })
  })

  describe("queryMemberPools", () => {
    it("should correctly map isConnected and totalAmountClaimed from poolMembers", async () => {
      const mockAccount = "0x0000000000000000000000000000000000000001" as Address
      
      requestMock.mockResolvedValue({
        pools: [
          {
            id: "0x0000000000000000000000000000000000000002",
            token: { id: "0x0000000000000000000000000000000000000003", symbol: "SUP" },
            totalUnits: "1000",
            totalAmountDistributedUntilUpdatedAt: "99999", // This should NOT be mapped to totalAmountClaimed
            flowRate: "100",
            admin: { id: "0x0000000000000000000000000000000000000004" },
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
        expect.stringContaining("poolMembers_"),
        expect.objectContaining({ account: mockAccount.toLowerCase() })
      )

      expect(pools).toHaveLength(1)
      const pool = pools[0]
      expect(pool.id).toBe("0x0000000000000000000000000000000000000002")
      expect(pool.isConnected).toBe(true)
      expect(pool.totalAmountClaimed).toBe(BigInt(42)) // Verifies rule #4 fix
      expect(pool.totalAmountClaimed).not.toBe(BigInt(99999))
    })

    it("should handle pools where member is disconnected (or poolMembers is empty/missing)", async () => {
      const mockAccount = "0x0000000000000000000000000000000000000001" as Address
      
      requestMock.mockResolvedValue({
        pools: [
          {
            id: "0x0000000000000000000000000000000000000002",
            token: { id: "0x0000000000000000000000000000000000000003", symbol: "SUP" },
            totalUnits: "1000",
            totalAmountDistributedUntilUpdatedAt: "99999",
            flowRate: "100",
            admin: { id: "0x0000000000000000000000000000000000000004" },
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

  describe("queryBalanceHistory", () => {
    it("should preserve second-based timestamps", async () => {
      const mockAccount = "0x0000000000000000000000000000000000000001" as Address
      requestMock.mockResolvedValue({ accountTokenSnapshotLogs: [] })

      await client.queryBalanceHistory({
        account: mockAccount,
        fromTimestamp: 1710000000,
        toTimestamp: 1710003600,
      })

      expect(requestMock).toHaveBeenCalledWith(
        expect.stringContaining("query GetBalanceHistory"),
        expect.objectContaining({
          account: mockAccount.toLowerCase(),
          fromTimestamp: 1710000000,
          toTimestamp: 1710003600,
        }),
      )
    })

    it("should normalize millisecond timestamps to seconds", async () => {
      const mockAccount = "0x0000000000000000000000000000000000000001" as Address
      requestMock.mockResolvedValue({ accountTokenSnapshotLogs: [] })

      await client.queryBalanceHistory({
        account: mockAccount,
        fromTimestamp: 1710000000000,
        toTimestamp: 1710003600000,
      })

      expect(requestMock).toHaveBeenCalledWith(
        expect.stringContaining("query GetBalanceHistory"),
        expect.objectContaining({
          account: mockAccount.toLowerCase(),
          fromTimestamp: 1710000000,
          toTimestamp: 1710003600,
        }),
      )
    })
  })

  describe("querySUPReserves", () => {
    it("should correctly map locker data", async () => {
      const mockAccount = "0x0000000000000000000000000000000000000001" as Address

      requestMock.mockResolvedValue({
        lockers: [
          {
            id: "0xLocker",
            lockerOwner: mockAccount,
            blockNumber: "12345",
            blockTimestamp: "67890",
            stakingData: { currentStakedBalance: "470101003130757339285" },
          },
        ],
      })

      const lockers = await client.querySUPReserves(mockAccount)

      const GraphQLClientMock = vi.mocked(GraphQLClient)
      expect(GraphQLClientMock).toHaveBeenCalledWith(
        SUBGRAPH_URLS.supReserve,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-api-key",
          }),
        })
      )

      expect(requestMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ account: mockAccount.toLowerCase() })
      )

      expect(lockers).toHaveLength(1)
      const locker = lockers[0]
      expect(locker.id).toBe("0xLocker")
      expect(locker.lockerOwner).toBe(mockAccount)
      expect(locker.blockNumber).toBe(BigInt(12345))
      expect(locker.blockTimestamp).toBe(BigInt(67890))
      expect(locker.stakedBalance).toBe(BigInt("470101003130757339285"))
    })

    it("should default stakedBalance to 0n when stakingData is absent", async () => {
      const mockAccount = "0x0000000000000000000000000000000000000002" as Address

      requestMock.mockResolvedValue({
        lockers: [
          {
            id: "0xLockerNoStake",
            lockerOwner: mockAccount,
            blockNumber: "1",
            blockTimestamp: "2",
            stakingData: null,
          },
        ],
      })

      const [locker] = await client.querySUPReserves(mockAccount)
      expect(locker.stakedBalance).toBe(BigInt(0))
    })

    it("should throw if account is missing", async () => {
      await expect(client.querySUPReserves("" as Address)).rejects.toThrow("account is required to fetch SUP reserves")
      const GraphQLClientMock = vi.mocked(GraphQLClient)
      expect(GraphQLClientMock).not.toHaveBeenCalledWith(
        SUBGRAPH_URLS.supReserve,
        expect.anything()
      )
      expect(requestMock).not.toHaveBeenCalled()
    })

    it("should throw if apiKey is missing", async () => {
      const noApiKeyClient = new SubgraphClient(SupportedChains.BASE) // No apiKey passed
      await expect(noApiKeyClient.querySUPReserves("0x0000000000000000000000000000000000000001" as Address)).rejects.toThrow(
        "Missing apiKey for SUP reserves subgraph (The Graph Gateway)."
      )
      const GraphQLClientMock = vi.mocked(GraphQLClient)
      expect(GraphQLClientMock).not.toHaveBeenCalledWith(
        SUBGRAPH_URLS.supReserve,
        expect.anything()
      )
      expect(requestMock).not.toHaveBeenCalled()
    })
  })
})

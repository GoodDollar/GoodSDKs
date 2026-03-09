import { describe, it, expect, vi, beforeEach } from "vitest"
import { GoodReserveSDK } from "../src/viem-reserve-sdk"
import { CELO_CHAIN_ID } from "../src/constants"
import type { PublicClient } from "viem"

const MOCK_TOKEN = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const
const MOCK_ACCOUNT = "0x0000000000000000000000000000000000000001" as const

const makeMockClient = (overrides: Partial<PublicClient> = {}): PublicClient =>
  ({
    chain: { id: CELO_CHAIN_ID },
    readContract: vi.fn(),
    getContractEvents: vi.fn(),
    getBlockNumber: vi.fn().mockResolvedValue(1000n),
    simulateContract: vi.fn(),
    ...overrides,
  }) as unknown as PublicClient

describe("GoodReserveSDK", () => {
  describe("constructor", () => {
    it("should throw if initialized with a non-Celo or non-XDC public client", () => {
      const badClient = { chain: { id: 1 } } as unknown as PublicClient
      expect(() => new GoodReserveSDK(badClient)).toThrow(
        "The GoodDollar reserve is only available on Celo and XDC",
      )
    })

    it("accepts a valid Celo public client", () => {
      const client = makeMockClient()
      expect(() => new GoodReserveSDK(client)).not.toThrow()
    })
  })

  describe("getBuyQuote", () => {
    let sdk: GoodReserveSDK
    let mockReadContract: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockReadContract = vi.fn().mockResolvedValue(500n)
      const client = makeMockClient({ readContract: mockReadContract } as any)
      sdk = new GoodReserveSDK(client)
    })

    it("returns the quoted G$ amount", async () => {
      const result = await sdk.getBuyQuote(MOCK_TOKEN, 100n)
      expect(result).toBe(500n)
      expect(mockReadContract).toHaveBeenCalledOnce()
    })

    it("throws for zero amountIn", async () => {
      await expect(sdk.getBuyQuote(MOCK_TOKEN, 0n)).rejects.toThrow(
        "amountIn must be greater than zero",
      )
    })

    it("throws for negative amountIn", async () => {
      await expect(sdk.getBuyQuote(MOCK_TOKEN, -1n)).rejects.toThrow(
        "amountIn must be greater than zero",
      )
    })
  })

  describe("getSellQuote", () => {
    it("throws for zero gdAmount", async () => {
      const sdk = new GoodReserveSDK(makeMockClient())
      await expect(sdk.getSellQuote(0n, MOCK_TOKEN)).rejects.toThrow(
        "gdAmount must be greater than zero",
      )
    })
  })

  describe("buy", () => {
    it("throws when no wallet client is provided", async () => {
      const sdk = new GoodReserveSDK(makeMockClient())
      await expect(sdk.buy(MOCK_TOKEN, 100n, 90n)).rejects.toThrow(
        "wallet client is required",
      )
    })

    it("throws for zero amountIn", async () => {
      const sdk = new GoodReserveSDK(makeMockClient(), {} as any)
      await expect(sdk.buy(MOCK_TOKEN, 0n, 0n)).rejects.toThrow(
        "amountIn must be greater than zero",
      )
    })
  })

  describe("getTransactionHistory", () => {
    it("returns empty array when no events found", async () => {
      const sdk = new GoodReserveSDK(
        makeMockClient({ getContractEvents: vi.fn().mockResolvedValue([]) }),
      )
      const result = await sdk.getTransactionHistory(MOCK_ACCOUNT)
      expect(result).toEqual([])
    })
  })
})

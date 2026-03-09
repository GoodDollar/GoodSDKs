import { describe, it, expect, vi, beforeEach } from "vitest"
import { GoodReserveSDK } from "../src/viem-reserve-sdk"
import { CELO_CHAIN_ID } from "../src/constants"
import type { PublicClient } from "viem"

const makeMockClient = (overrides: Partial<PublicClient> = {}): PublicClient =>
  ({
    chain: { id: CELO_CHAIN_ID },
    readContract: vi.fn(),
    simulateContract: vi.fn(),
    getBlockNumber: vi.fn().mockResolvedValue(1000n),
    getContractEvents: vi.fn().mockResolvedValue([]),
    ...overrides,
  }) as unknown as PublicClient

describe("GoodReserveSDK", () => {
  describe("constructor", () => {
    it("throws when not on Celo", () => {
      const client = makeMockClient({ chain: { id: 1 } } as any)
      expect(() => new GoodReserveSDK(client)).toThrow(
        "only available on Celo",
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
      const result = await sdk.getBuyQuote(
        "0x765DE816845861e75A25fCA122bb6898B8B1282a",
        100n,
      )
      expect(result).toBe(500n)
      expect(mockReadContract).toHaveBeenCalledOnce()
    })

    it("throws for zero amountIn", async () => {
      await expect(
        sdk.getBuyQuote("0x765DE816845861e75A25fCA122bb6898B8B1282a", 0n),
      ).rejects.toThrow("amountIn must be greater than zero")
    })

    it("throws for negative amountIn", async () => {
      await expect(
        sdk.getBuyQuote("0x765DE816845861e75A25fCA122bb6898B8B1282a", -1n),
      ).rejects.toThrow("amountIn must be greater than zero")
    })
  })

  describe("getSellQuote", () => {
    it("throws for zero gdAmount", async () => {
      const sdk = new GoodReserveSDK(makeMockClient())
      await expect(
        sdk.getSellQuote(0n, "0x765DE816845861e75A25fCA122bb6898B8B1282a"),
      ).rejects.toThrow("gdAmount must be greater than zero")
    })
  })

  describe("buy", () => {
    it("throws when no wallet client is provided", async () => {
      const sdk = new GoodReserveSDK(makeMockClient())
      await expect(
        sdk.buy(
          "0x765DE816845861e75A25fCA122bb6898B8B1282a",
          100n,
          90n,
        ),
      ).rejects.toThrow("wallet client is required")
    })

    it("throws for zero amountIn", async () => {
      const sdk = new GoodReserveSDK(makeMockClient(), {} as any)
      await expect(
        sdk.buy("0x765DE816845861e75A25fCA122bb6898B8B1282a", 0n, 0n),
      ).rejects.toThrow("amountIn must be greater than zero")
    })
  })

  describe("getTransactionHistory", () => {
    it("returns empty array when no events found", async () => {
      const sdk = new GoodReserveSDK(makeMockClient())
      const result = await sdk.getTransactionHistory(
        "0x0000000000000000000000000000000000000001",
      )
      expect(result).toEqual([])
    })
  })
})

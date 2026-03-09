import { describe, it, expect, vi, beforeEach } from "vitest"
import { GoodReserveSDK } from "../src/viem-reserve-sdk"
import {
  CELO_CHAIN_ID,
  XDC_CHAIN_ID,
  RESERVE_CONTRACT_ADDRESSES,
} from "../src/constants"
import type { PublicClient } from "viem"

const CELO_PROD_STABLE = RESERVE_CONTRACT_ADDRESSES.production.celo.stableToken
const CELO_PROD_GD = RESERVE_CONTRACT_ADDRESSES.production.celo.goodDollar
const XDC_DEV_STABLE = RESERVE_CONTRACT_ADDRESSES.development.xdc.stableToken
const XDC_DEV_GD = RESERVE_CONTRACT_ADDRESSES.development.xdc.goodDollar

const MOCK_EXCHANGE_ID = "0x1111111111111111111111111111111111111111111111111111111111111111" as `0x${string}`

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
    it("throws on unsupported chain", () => {
      const client = makeMockClient({ chain: { id: 1 } } as any)
      expect(() => new GoodReserveSDK(client)).toThrow("Unsupported chain id")
    })

    it("accepts a valid Celo public client", () => {
      const client = makeMockClient()
      expect(() => new GoodReserveSDK(client)).not.toThrow()
    })

    it("accepts a valid XDC public client", () => {
      const client = makeMockClient({ chain: { id: XDC_CHAIN_ID } } as any)
      expect(() => new GoodReserveSDK(client, undefined, "development")).not.toThrow()
    })
  })

  describe("getBuyQuote", () => {
    let sdk: GoodReserveSDK
    let mockReadContract: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockReadContract = vi.fn().mockImplementation((req: any) => {
        const fn = String(req.functionName)
        if (fn === "getExchangeIds") return [MOCK_EXCHANGE_ID]
        if (fn === "getPoolExchange") {
          return [CELO_PROD_STABLE, CELO_PROD_GD, 0n, 0n, 1, 1]
        }
        if (fn === "getAmountOut") return 500n
        return 0n
      })
      const client = makeMockClient({ readContract: mockReadContract } as any)
      sdk = new GoodReserveSDK(client)
    })

    it("returns the quoted G$ amount on Celo", async () => {
      const result = await sdk.getBuyQuote(CELO_PROD_STABLE, 100n)
      expect(result).toBe(500n)
      expect(mockReadContract).toHaveBeenCalled()
    })

    it("returns quoted amount on XDC via Mento broker", async () => {
      const mockReadContract = vi.fn().mockImplementation((req: any) => {
        const fn = String(req.functionName)
        if (fn === "getExchangeIds") return [MOCK_EXCHANGE_ID]
        if (fn === "getPoolExchange") {
          return [XDC_DEV_STABLE, XDC_DEV_GD, 0n, 0n, 1, 1]
        }
        if (fn === "getAmountOut") return 700n
        return 0n
      })

      const sdk = new GoodReserveSDK(
        makeMockClient({
          chain: { id: XDC_CHAIN_ID },
          readContract: mockReadContract,
        } as any),
        undefined,
        "development",
      )

      const result = await sdk.getBuyQuote(XDC_DEV_STABLE, 100n)
      expect(result).toBe(700n)
    })

    it("throws for zero amountIn", async () => {
      await expect(
        sdk.getBuyQuote("0x765DE816845861e75A25fCA122bb6898B8B1282a", 0n),
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
        sdk.buy("0x765DE816845861e75A25fCA122bb6898B8B1282a", 100n, 90n),
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
      const mockReadContract = vi.fn().mockImplementation((req: any) => {
        const fn = String(req.functionName)
        if (fn === "getExchangeIds") return [MOCK_EXCHANGE_ID]
        if (fn === "getPoolExchange") {
          return [CELO_PROD_STABLE, CELO_PROD_GD, 0n, 0n, 1, 1]
        }
        return 0n
      })
      const sdk = new GoodReserveSDK(makeMockClient({ readContract: mockReadContract } as any))
      const result = await sdk.getTransactionHistory(
        "0x0000000000000000000000000000000000000001",
      )
      expect(result).toEqual([])
    })

    it("decodes XDC broker swap events", async () => {
      const mockReadContract = vi.fn().mockImplementation((req: any) => {
        const fn = String(req.functionName)
        if (fn === "getExchangeIds") return [MOCK_EXCHANGE_ID]
        if (fn === "getPoolExchange") {
          return [XDC_DEV_STABLE, XDC_DEV_GD, 0n, 0n, 1, 1]
        }
        return 0n
      })

      const mockGetContractEvents = vi.fn().mockResolvedValue([
        {
          args: {
            exchangeId: MOCK_EXCHANGE_ID,
            trader: "0x0000000000000000000000000000000000000001",
            tokenIn: XDC_DEV_STABLE,
            tokenOut: XDC_DEV_GD,
            amountIn: 100n,
            amountOut: 250n,
          },
          transactionHash:
            "0x1111111111111111111111111111111111111111111111111111111111111111",
          blockNumber: 900n,
        },
      ])

      const sdk = new GoodReserveSDK(
        makeMockClient({
          chain: { id: XDC_CHAIN_ID },
          readContract: mockReadContract,
          getContractEvents: mockGetContractEvents,
        } as any),
        undefined,
        "development",
      )

      const result = await sdk.getTransactionHistory(
        "0x0000000000000000000000000000000000000001",
      )

      expect(result).toHaveLength(1)
      expect(result[0]?.type).toBe("buy")
      expect(result[0]?.amountOut).toBe(250n)
    })
  })
})

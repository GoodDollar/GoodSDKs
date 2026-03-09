import { describe, it, expect, vi, beforeEach } from "vitest"
import { GoodReserveSDK } from "../src/viem-reserve-sdk"
import {
  CELO_CHAIN_ID,
  XDC_CHAIN_ID,
  RESERVE_CONTRACT_ADDRESSES,
} from "../src/constants"
import type { PublicClient, WalletClient } from "viem"

// Mock viem/actions so waitForTransactionReceipt is interceptable.
vi.mock("viem/actions", () => ({
  waitForTransactionReceipt: vi.fn().mockResolvedValue({
    transactionHash:
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  }),
}))

const CELO_PROD_STABLE = RESERVE_CONTRACT_ADDRESSES.production.celo.stableToken
const CELO_PROD_GD = RESERVE_CONTRACT_ADDRESSES.production.celo.goodDollar
const XDC_DEV_STABLE = RESERVE_CONTRACT_ADDRESSES.development.xdc.stableToken
const XDC_DEV_GD = RESERVE_CONTRACT_ADDRESSES.development.xdc.goodDollar

const MOCK_EXCHANGE_ID =
  "0x1111111111111111111111111111111111111111111111111111111111111111" as `0x${string}`
const MOCK_TX_HASH =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`

// ─── Mock factories ────────────────────────────────────────────────────────────

/**
 * All readContract mocks must return Promises because getMentoExchangeId now
 * calls .then() on each result when fanning out pool reads in parallel.
 */
const makeAsyncFn =
  (impl: (req: any) => unknown) =>
  (req: any) =>
    Promise.resolve(impl(req))

const makeMockClient = (overrides: Partial<PublicClient> = {}): PublicClient =>
  ({
    chain: { id: CELO_CHAIN_ID },
    readContract: vi.fn().mockResolvedValue(0n),
    simulateContract: vi.fn().mockResolvedValue({ request: {} }),
    getBlockNumber: vi.fn().mockResolvedValue(1000n),
    getContractEvents: vi.fn().mockResolvedValue([]),
    ...overrides,
  }) as unknown as PublicClient

const makeMockWallet = (): WalletClient =>
  ({
    getAddresses: vi
      .fn()
      .mockResolvedValue(["0x1111111111111111111111111111111111111111"]),
    writeContract: vi.fn().mockResolvedValue(MOCK_TX_HASH),
  }) as unknown as WalletClient

/**
 * Returns a readContract mock that simulates the Mento broker path with a
 * matching pool for the provided stableToken / goodDollar pair.
 * Uses Promise.resolve so that .then() in getMentoExchangeId works correctly.
 */
const makeMentoReadContract = (
  stable: `0x${string}`,
  gd: `0x${string}`,
  quoteAmount = 500n,
) =>
  vi.fn().mockImplementation(
    makeAsyncFn((req) => {
      const fn = String(req.functionName)
      if (fn === "getExchangeIds") return [MOCK_EXCHANGE_ID]
      if (fn === "getPoolExchange") return [stable, gd, 2000000n, 350000n, 500000, 0]
      if (fn === "getAmountOut") return quoteAmount
      if (fn === "totalSupply") return 123456789n
      if (fn === "decimals") return 18
      if (fn === "allowance") return 0n
      return 0n
    }),
  )

/**
 * Fake addresses for the exchange-helper path.
 * NOTE: No current production/staging address map uses exchange-helper mode.
 * These tests cover the branch logic that is reserved for a future XDC
 * production deployment.
 */
const MOCK_EXCHANGE_HELPER =
  "0xEEEE000000000000000000000000000000000001" as `0x${string}`
const MOCK_BUY_GD_FACTORY =
  "0xEEEE000000000000000000000000000000000002" as `0x${string}`
const MOCK_GD = "0xEEEE000000000000000000000000000000000003" as `0x${string}`
const MOCK_STABLE =
  "0xEEEE000000000000000000000000000000000004" as `0x${string}`

/** Creates an SDK internally overridden to use a fake exchange-helper config. */
const makeExchangeHelperSdk = (
  readContract: ReturnType<typeof vi.fn>,
  overridePublicClient?: PublicClient,
) => {
  const client = overridePublicClient ?? makeMockClient({ readContract } as any)
  const sdk = new GoodReserveSDK(client)
  const anySDK = sdk as any
  anySDK.contracts = {
    mode: "exchange-helper",
    exchangeHelper: MOCK_EXCHANGE_HELPER,
    buyGDFactory: MOCK_BUY_GD_FACTORY,
    goodDollar: MOCK_GD,
    stableToken: MOCK_STABLE,
  }
  return sdk
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("GoodReserveSDK", () => {
  // ── constructor ──────────────────────────────────────────────────────────────
  describe("constructor", () => {
    it("throws on unsupported chain", () => {
      const client = makeMockClient({ chain: { id: 1 } } as any)
      expect(() => new GoodReserveSDK(client)).toThrow("Unsupported chain id")
    })

    it("accepts a valid Celo public client", () => {
      expect(() => new GoodReserveSDK(makeMockClient())).not.toThrow()
    })

    it("accepts a valid XDC public client", () => {
      const client = makeMockClient({ chain: { id: XDC_CHAIN_ID } } as any)
      expect(() =>
        new GoodReserveSDK(client, undefined, "development"),
      ).not.toThrow()
    })
  })

  // ── getBuyQuote ──────────────────────────────────────────────────────────────
  describe("getBuyQuote", () => {
    let sdk: GoodReserveSDK
    let mockReadContract: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockReadContract = makeMentoReadContract(CELO_PROD_STABLE, CELO_PROD_GD)
      sdk = new GoodReserveSDK(makeMockClient({ readContract: mockReadContract } as any))
    })

    it("returns the quoted G$ amount on Celo via Mento broker", async () => {
      const result = await sdk.getBuyQuote(CELO_PROD_STABLE, 100n)
      expect(result).toBe(500n)
      expect(mockReadContract).toHaveBeenCalled()
    })

    it("returns quoted amount on XDC via Mento broker", async () => {
      const rc = makeMentoReadContract(XDC_DEV_STABLE, XDC_DEV_GD, 700n)
      const xdcSdk = new GoodReserveSDK(
        makeMockClient({ chain: { id: XDC_CHAIN_ID }, readContract: rc } as any),
        undefined,
        "development",
      )
      expect(await xdcSdk.getBuyQuote(XDC_DEV_STABLE, 100n)).toBe(700n)
    })

    it("throws for zero amountIn", async () => {
      await expect(sdk.getBuyQuote(CELO_PROD_STABLE, 0n)).rejects.toThrow(
        "amountIn must be greater than zero",
      )
    })

    it("calls getBuyQuote on buyGDFactory in exchange-helper mode", async () => {
      const rc = vi
        .fn()
        .mockImplementation(makeAsyncFn((req) =>
          req.functionName === "getBuyQuote" ? 300n : 0n,
        ))
      const result = await makeExchangeHelperSdk(rc).getBuyQuote(MOCK_STABLE, 50n)
      expect(result).toBe(300n)
      expect(rc).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "getBuyQuote" }),
      )
    })
  })

  // ── getSellQuote ─────────────────────────────────────────────────────────────
  describe("getSellQuote", () => {
    it("throws for zero gdAmount", async () => {
      await expect(
        new GoodReserveSDK(makeMockClient()).getSellQuote(0n, CELO_PROD_STABLE),
      ).rejects.toThrow("gdAmount must be greater than zero")
    })

    it("returns the quoted stable amount on Celo via Mento broker", async () => {
      const rc = makeMentoReadContract(CELO_PROD_STABLE, CELO_PROD_GD, 88n)
      const sdk = new GoodReserveSDK(makeMockClient({ readContract: rc } as any))
      expect(await sdk.getSellQuote(100n, CELO_PROD_STABLE)).toBe(88n)
    })

    it("calls getSellQuote on buyGDFactory in exchange-helper mode", async () => {
      const rc = vi
        .fn()
        .mockImplementation(makeAsyncFn((req) =>
          req.functionName === "getSellQuote" ? 42n : 0n,
        ))
      const result = await makeExchangeHelperSdk(rc).getSellQuote(100n, MOCK_STABLE)
      expect(result).toBe(42n)
      expect(rc).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "getSellQuote" }),
      )
    })
  })

  // ── buy ──────────────────────────────────────────────────────────────────────
  describe("buy", () => {
    it("throws when no wallet client is provided", async () => {
      await expect(
        new GoodReserveSDK(makeMockClient()).buy(CELO_PROD_STABLE, 100n, 90n),
      ).rejects.toThrow("wallet client is required")
    })

    it("throws for zero amountIn", async () => {
      await expect(
        new GoodReserveSDK(makeMockClient(), {} as any).buy(CELO_PROD_STABLE, 0n, 0n),
      ).rejects.toThrow("amountIn must be greater than zero")
    })

    it("approves then calls swapIn on Mento broker", async () => {
      const rc = makeMentoReadContract(CELO_PROD_STABLE, CELO_PROD_GD)
      const simulateContract = vi.fn().mockResolvedValue({ request: {} })
      const wc = makeMockWallet()
      const publicClient = makeMockClient({ readContract: rc, simulateContract } as any)

      const sdk = new GoodReserveSDK(publicClient, wc)
      const result = await sdk.buy(CELO_PROD_STABLE, 100n, 90n)

      expect(result.hash).toBe(MOCK_TX_HASH)
      // Called at least twice: approve + swapIn
      expect(simulateContract).toHaveBeenCalledTimes(2)
      expect(simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "swapIn" }),
      )
    })

    it("exactApproval=true approves the exact required amount", async () => {
      const rc = makeMentoReadContract(CELO_PROD_STABLE, CELO_PROD_GD)
      const simulateContract = vi.fn().mockResolvedValue({ request: {} })
      const wc = makeMockWallet()
      const publicClient = makeMockClient({ readContract: rc, simulateContract } as any)

      const sdk = new GoodReserveSDK(publicClient, wc, "production", {
        exactApproval: true,
      })
      await sdk.buy(CELO_PROD_STABLE, 100n, 90n)

      const approveCall = simulateContract.mock.calls.find(
        ([p]: any[]) => p?.functionName === "approve",
      )
      expect(approveCall).toBeDefined()
      // args[1] must be the exact amount (100n), not maxUint256
      expect(approveCall![0].args[1]).toBe(100n)
    })
  })

  // ── getTransactionHistory ────────────────────────────────────────────────────
  describe("getTransactionHistory", () => {
    it("returns empty array when no events found", async () => {
      const rc = makeMentoReadContract(CELO_PROD_STABLE, CELO_PROD_GD)
      const sdk = new GoodReserveSDK(makeMockClient({ readContract: rc } as any))
      const result = await sdk.getTransactionHistory(
        "0x0000000000000000000000000000000000000001",
      )
      expect(result).toEqual([])
    })

    it("decodes XDC broker Swap events correctly", async () => {
      const rc = makeMentoReadContract(XDC_DEV_STABLE, XDC_DEV_GD)
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
          transactionHash: MOCK_TX_HASH,
          blockNumber: 900n,
        },
      ])

      const sdk = new GoodReserveSDK(
        makeMockClient({
          chain: { id: XDC_CHAIN_ID },
          readContract: rc,
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

    it("decodes exchange-helper TokenPurchased events as buy", async () => {
      const mockGetContractEvents = vi.fn().mockImplementation((req: any) => {
        if (req.eventName === "TokenPurchased") {
          return Promise.resolve([
            {
              args: {
                caller: "0x0000000000000000000000000000000000000002",
                inputToken: MOCK_STABLE,
                inputAmount: 10n,
                actualReturn: 50n,
                receiverAddress: "0x0000000000000000000000000000000000000002",
              },
              transactionHash: MOCK_TX_HASH,
              blockNumber: 800n,
            },
          ])
        }
        return Promise.resolve([])
      })

      const xhSdk = makeExchangeHelperSdk(
        vi.fn().mockResolvedValue(0n),
        makeMockClient({
          getBlockNumber: vi.fn().mockResolvedValue(1000n),
          getContractEvents: mockGetContractEvents,
        } as any),
      )

      const result = await xhSdk.getTransactionHistory(
        "0x0000000000000000000000000000000000000002",
      )
      expect(result).toHaveLength(1)
      expect(result[0]?.type).toBe("buy")
      expect(result[0]?.amountOut).toBe(50n)
    })

    it("decodes exchange-helper TokenSold events as sell", async () => {
      const mockGetContractEvents = vi.fn().mockImplementation((req: any) => {
        if (req.eventName === "TokenSold") {
          return Promise.resolve([
            {
              args: {
                caller: "0x0000000000000000000000000000000000000002",
                outputToken: MOCK_STABLE,
                gdAmount: 20n,
                contributionAmount: 1n,
                actualReturn: 15n,
                receiverAddress: "0x0000000000000000000000000000000000000002",
              },
              transactionHash: MOCK_TX_HASH,
              blockNumber: 810n,
            },
          ])
        }
        return Promise.resolve([])
      })

      const xhSdk = makeExchangeHelperSdk(
        vi.fn().mockResolvedValue(0n),
        makeMockClient({
          getBlockNumber: vi.fn().mockResolvedValue(1000n),
          getContractEvents: mockGetContractEvents,
        } as any),
      )

      const result = await xhSdk.getTransactionHistory(
        "0x0000000000000000000000000000000000000002",
      )
      expect(result).toHaveLength(1)
      expect(result[0]?.type).toBe("sell")
      expect(result[0]?.amountIn).toBe(20n)
      expect(result[0]?.amountOut).toBe(15n)
    })
  })

  // ── reserve diagnostics ───────────────────────────────────────────────────────
  describe("reserve diagnostics", () => {
    it("returns route info with active mento addresses", () => {
      const info = new GoodReserveSDK(makeMockClient()).getRouteInfo()
      expect(info.chainId).toBe(CELO_CHAIN_ID)
      expect(info.mode).toBe("mento-broker")
      expect(info.broker).toBe(RESERVE_CONTRACT_ADDRESSES.production.celo.broker)
      expect(info.exchangeProvider).toBe(
        RESERVE_CONTRACT_ADDRESSES.production.celo.exchangeProvider,
      )
    })

    it("returns reserve stats from broker pool (extractPoolStats)", async () => {
      const rc = vi.fn().mockImplementation(
        makeAsyncFn((req) => {
          const fn = String(req.functionName)
          if (fn === "totalSupply") return 123456789n
          if (fn === "decimals") return 18
          if (fn === "getExchangeIds") return [MOCK_EXCHANGE_ID]
          if (fn === "getPoolExchange")
            return [CELO_PROD_STABLE, CELO_PROD_GD, 2000000n, 350000n, 500000, 0]
          return 0n
        }),
      )

      const stats = await new GoodReserveSDK(
        makeMockClient({ readContract: rc } as any),
      ).getReserveStats()

      expect(stats.goodDollarTotalSupply).toBe(123456789n)
      expect(stats.stableTokenDecimals).toBe(18)
      expect(stats.goodDollarDecimals).toBe(18)
      expect(stats.poolTokenSupply).toBe(2000000n)
      expect(stats.poolReserveBalance).toBe(350000n)
      expect(stats.reserveRatio).toBe(500000)
    })

    it("returns null pool fields for exchange-helper mode", async () => {
      const rc = vi.fn().mockImplementation(
        makeAsyncFn((req) => {
          if (req.functionName === "totalSupply") return 999n
          if (req.functionName === "decimals") return 2
          return 0n
        }),
      )
      const stats = await makeExchangeHelperSdk(
        rc,
        makeMockClient({ readContract: rc } as any),
      ).getReserveStats()

      expect(stats.goodDollarTotalSupply).toBe(999n)
      expect(stats.poolReserveBalance).toBeNull()
      expect(stats.poolTokenSupply).toBeNull()
      expect(stats.reserveRatio).toBeNull()
      expect(stats.exitContribution).toBeNull()
    })

    it("route info reflects exchange-helper contract addresses", () => {
      const info = makeExchangeHelperSdk(vi.fn()).getRouteInfo()
      expect(info.mode).toBe("exchange-helper")
      expect(info.exchangeHelper).toBe(MOCK_EXCHANGE_HELPER)
      expect(info.buyGDFactory).toBe(MOCK_BUY_GD_FACTORY)
    })
  })

  // ── parallel pool discovery ───────────────────────────────────────────────────
  describe("parallel pool discovery", () => {
    it("fans out getPoolExchange calls for multiple exchange ids", async () => {
      const EXCHANGE_ID_2 =
        "0x2222222222222222222222222222222222222222222222222222222222222222" as `0x${string}`
      const poolCallIds: string[] = []

      const rc = vi.fn().mockImplementation(
        makeAsyncFn((req) => {
          const fn = String(req.functionName)
          if (fn === "getExchangeIds") return [MOCK_EXCHANGE_ID, EXCHANGE_ID_2]
          if (fn === "getPoolExchange") {
            poolCallIds.push(String(req.args?.[0]))
            // Only the second pool matches
            if (req.args?.[0] === EXCHANGE_ID_2) {
              return [CELO_PROD_STABLE, CELO_PROD_GD, 0n, 0n, 1, 1]
            }
            return [
              "0x0000000000000000000000000000000000000000",
              "0x0000000000000000000000000000000000000000",
              0n,
              0n,
              1,
              1,
            ]
          }
          if (fn === "getAmountOut") return 123n
          return 0n
        }),
      )

      const result = await new GoodReserveSDK(
        makeMockClient({ readContract: rc } as any),
      ).getBuyQuote(CELO_PROD_STABLE, 10n)

      // Both pool reads must have been initiated (confirming concurrent fan-out)
      expect(poolCallIds).toContain(MOCK_EXCHANGE_ID)
      expect(poolCallIds).toContain(EXCHANGE_ID_2)
      expect(result).toBe(123n)
    })
  })
})

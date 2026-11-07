import { describe, it, expect, vi, beforeEach } from "vitest"
import { waitForTransactionReceipt } from "viem/actions"
import {
  GoodReserveSDK,
  ReserveTransactionError,
  normalizeReserveStats,
  type ReserveStats,
} from "../src/index"
import {
  CELO_CHAIN_ID,
  XDC_CHAIN_ID,
  RESERVE_CONTRACT_ADDRESSES,
} from "../src/constants"
import type { PublicClient, WalletClient } from "viem"

vi.mock("viem/actions", () => ({
  waitForTransactionReceipt: vi.fn(),
}))

const mockedWaitForTransactionReceipt = vi.mocked(waitForTransactionReceipt)

const CELO_PROD_STABLE = RESERVE_CONTRACT_ADDRESSES.production.celo.stableToken
const CELO_PROD_GD = RESERVE_CONTRACT_ADDRESSES.production.celo.goodDollar
const XDC_PROD_STABLE = "0xfA2958CB79b0491CC627c1557F441eF849Ca8eb1"
const XDC_PROD_GD = "0xEC2136843a983885AebF2feB3931F73A8eBEe50c"
const XDC_PROD_BROKER = "0x88de45906D4F5a57315c133620cfa484cB297541"
const XDC_PROD_PROVIDER = "0x2fFBB49055d487DdBBb0C052Cd7c2a02A7971e41"
const XDC_DEV_STABLE = RESERVE_CONTRACT_ADDRESSES.development.xdc.stableToken
const XDC_DEV_GD = RESERVE_CONTRACT_ADDRESSES.development.xdc.goodDollar

const MOCK_EXCHANGE_ID =
  "0x0000000000000000000000000000000000000000000000000000000000001111" as `0x${string}`
const MOCK_TX_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000001234" as `0x${string}`
const MOCK_BLOCK_NUMBER = 12_345n

// ─── Mock factories ────────────────────────────────────────────────────────────

/**
 * These mocks have to return hard Promises because getMentoExchangeId chains
 * .then() on them for the parallel pool fan-out.
 */
const makeAsyncFn = (impl: (req: any) => unknown) => (req: any) =>
  Promise.resolve(impl(req))

const makeMockClient = (overrides: Partial<PublicClient> = {}): PublicClient =>
  ({
    chain: { id: CELO_CHAIN_ID },
    readContract: vi.fn().mockResolvedValue(0n),
    simulateContract: vi.fn().mockResolvedValue({ request: {} }),
    getBlockNumber: vi.fn().mockResolvedValue(1000n),
    getBlock: vi.fn().mockResolvedValue({ timestamp: 1710000000n }),
    getContractEvents: vi.fn().mockResolvedValue([]),
    ...overrides,
  }) as unknown as PublicClient

const makeMockWallet = (chainId = CELO_CHAIN_ID): WalletClient =>
  ({
    getChainId: vi.fn().mockResolvedValue(chainId),
    getAddresses: vi
      .fn()
      .mockResolvedValue(["0x0000000000000000000000000000000000000001"]),
    writeContract: vi.fn().mockResolvedValue(MOCK_TX_HASH),
  }) as unknown as WalletClient

/**
 * Builds a readContract mock that acts like a Mento broker with a matching
 * pool for our token pair.
 */
const makeMentoReadContract = (
  stable: `0x${string}`,
  gd: `0x${string}`,
  quoteAmount = 500n,
) => {
  let allowanceReads = 0
  return vi.fn().mockImplementation(
    makeAsyncFn((req) => {
      const fn = String(req.functionName)
      if (fn === "getExchangeIds") return [MOCK_EXCHANGE_ID]
      if (fn === "getPoolExchange")
        return [stable, gd, 2000000n, 350000n, 500000, 0]
      if (fn === "getAmountOut") return quoteAmount
      if (fn === "totalSupply") return 123456789n
      if (fn === "decimals") return 18
      if (fn === "allowance") {
        allowanceReads += 1
        return allowanceReads === 1 ? 0n : 10_000_000n
      }
      return 0n
    }),
  )
}


// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("GoodReserveSDK", () => {
  beforeEach(() => {
    mockedWaitForTransactionReceipt.mockReset()
    mockedWaitForTransactionReceipt.mockResolvedValue({
      transactionHash: MOCK_TX_HASH,
      status: "success",
      blockNumber: MOCK_BLOCK_NUMBER,
    } as Awaited<ReturnType<typeof waitForTransactionReceipt>>)
  })

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
      expect(
        () => new GoodReserveSDK(client, undefined, "development"),
      ).not.toThrow()
    })

    it("constructs production XDC with its own tokens and published endpoints", () => {
      const client = makeMockClient({ chain: { id: XDC_CHAIN_ID } } as any)
      expect(new GoodReserveSDK(client).getRouteInfo()).toEqual({
        env: "production",
        chainId: XDC_CHAIN_ID,
        mode: "mento-broker",
        broker: XDC_PROD_BROKER,
        exchangeProvider: XDC_PROD_PROVIDER,
        goodDollar: XDC_PROD_GD,
        stableToken: XDC_PROD_STABLE,
      })
    })

    it("throws with configured reason on unavailable chain/env (XDC staging)", () => {
      const client = makeMockClient({ chain: { id: XDC_CHAIN_ID } } as any)
      const config = RESERVE_CONTRACT_ADDRESSES.staging.xdc
      const reason = (config as any).reason ?? "Reserve not available"
      expect(() => new GoodReserveSDK(client, undefined, "staging")).toThrow(
        reason,
      )
    })
  })

  describe.each(["buy", "sell"] as const)("production XDC %s", (direction) => {
    const setup = () => {
      const readContract = makeMentoReadContract(XDC_PROD_STABLE, XDC_PROD_GD)
      const client = makeMockClient({
        chain: { id: XDC_CHAIN_ID },
        readContract,
      } as any)
      const wallet = makeMockWallet(XDC_CHAIN_ID)
      const sdk = new GoodReserveSDK(client, wallet, "production")
      return { readContract, client, wallet, sdk }
    }

    it("discovers and quotes the production token pair through the broker", async () => {
      const { sdk, readContract } = setup()
      const quote = direction === "buy"
        ? sdk.getBuyQuote(XDC_PROD_STABLE, 100n)
        : sdk.getSellQuote(100n, XDC_PROD_STABLE)
      expect(await quote).toBe(500n)
      expect(readContract).toHaveBeenCalledWith(expect.objectContaining({
        address: XDC_PROD_PROVIDER,
        functionName: "getPoolExchange",
        args: [MOCK_EXCHANGE_ID],
      }))
      expect(readContract).toHaveBeenCalledWith(expect.objectContaining({
        address: XDC_PROD_BROKER,
        functionName: "getAmountOut",
        args: [
          XDC_PROD_PROVIDER,
          MOCK_EXCHANGE_ID,
          direction === "buy" ? XDC_PROD_STABLE : XDC_PROD_GD,
          direction === "buy" ? XDC_PROD_GD : XDC_PROD_STABLE,
          100n,
        ],
      }))
    })

    it("returns a successful receipt and writes only the production route", async () => {
      const { sdk, client, wallet } = setup()
      const result = await sdk[direction](XDC_PROD_STABLE, 100n, 90n)
      expect(result.receipt.status).toBe("success")
      expect(client.simulateContract).toHaveBeenNthCalledWith(1, expect.objectContaining({
        address: direction === "buy" ? XDC_PROD_STABLE : XDC_PROD_GD,
        functionName: "approve",
        args: [XDC_PROD_BROKER, 100n],
      }))
      expect(client.simulateContract).toHaveBeenNthCalledWith(2, expect.objectContaining({
        address: XDC_PROD_BROKER,
        functionName: "swapIn",
        args: [
          XDC_PROD_PROVIDER,
          MOCK_EXCHANGE_ID,
          direction === "buy" ? XDC_PROD_STABLE : XDC_PROD_GD,
          direction === "buy" ? XDC_PROD_GD : XDC_PROD_STABLE,
          100n,
          90n,
        ],
      }))
      expect(wallet.writeContract).toHaveBeenLastCalledWith(expect.objectContaining({
        chain: client.chain,
      }))
    })

    it.each(["Approval", "Swap"])("rejects a reverted %s receipt with diagnostics", async (operation) => {
      const { sdk, wallet } = setup()
      const receipt = {
        transactionHash: MOCK_TX_HASH,
        status: "reverted",
        blockNumber: MOCK_BLOCK_NUMBER,
      } as Awaited<ReturnType<typeof waitForTransactionReceipt>>
      if (operation === "Swap") {
        mockedWaitForTransactionReceipt.mockResolvedValueOnce({
          ...receipt, status: "success",
        })
      }
      mockedWaitForTransactionReceipt.mockResolvedValueOnce(receipt)
      const pending = sdk[direction](XDC_PROD_STABLE, 100n, 90n)
      await expect(pending).rejects.toBeInstanceOf(ReserveTransactionError)
      await expect(pending).rejects.toMatchObject({
        operation,
        hash: MOCK_TX_HASH,
        receipt,
        message: expect.stringContaining(`${operation} transaction reverted on-chain.`),
      })
      expect(wallet.writeContract).toHaveBeenCalledTimes(operation === "Approval" ? 1 : 2)
    })

    it("rejects a mismatched live wallet chain before submitting anything", async () => {
      const { sdk, wallet } = setup()
      vi.mocked(wallet.getChainId).mockResolvedValue(CELO_CHAIN_ID)
      await expect(sdk[direction](XDC_PROD_STABLE, 100n, 90n)).rejects.toThrow("Switch your wallet to chain 50")
      expect(wallet.writeContract).not.toHaveBeenCalled()
    })

    it("rejects a chain change between approval and swap", async () => {
      const { sdk, wallet } = setup()
      mockedWaitForTransactionReceipt.mockImplementationOnce(async () => {
        vi.mocked(wallet.getChainId).mockResolvedValue(CELO_CHAIN_ID)
        return {
          transactionHash: MOCK_TX_HASH, status: "success", blockNumber: MOCK_BLOCK_NUMBER,
        } as Awaited<ReturnType<typeof waitForTransactionReceipt>>
      })
      await expect(sdk[direction](XDC_PROD_STABLE, 100n, 90n)).rejects.toThrow("Switch your wallet to chain 50")
      expect(wallet.writeContract).toHaveBeenCalledTimes(1)
    })

    it("rechecks the wallet after simulation, before submitting approval", async () => {
      const { sdk, client, wallet } = setup()
      vi.mocked(client.simulateContract).mockImplementationOnce(async () => {
        vi.mocked(wallet.getChainId).mockResolvedValue(CELO_CHAIN_ID)
        return { request: {} } as any
      })
      await expect(sdk[direction](XDC_PROD_STABLE, 100n, 90n)).rejects.toThrow("Switch your wallet to chain 50")
      expect(wallet.writeContract).not.toHaveBeenCalled()
    })

    it("falls back to walletClient.chain.id when getChainId is not provided", async () => {
      const readContract = makeMentoReadContract(XDC_PROD_STABLE, XDC_PROD_GD)
      const client = makeMockClient({
        chain: { id: XDC_CHAIN_ID },
        readContract,
      } as any)
      const wallet = {
        chain: { id: CELO_CHAIN_ID },
        getAddresses: vi
          .fn()
          .mockResolvedValue(["0x0000000000000000000000000000000000000001"]),
        writeContract: vi.fn().mockResolvedValue(MOCK_TX_HASH),
      } as unknown as WalletClient
      const sdk = new GoodReserveSDK(client, wallet, "production")
      await expect(sdk[direction](XDC_PROD_STABLE, 100n, 90n)).rejects.toThrow("Switch your wallet to chain 50")
      expect(wallet.writeContract).not.toHaveBeenCalled()
    })
  })

  // ── getBuyQuote ──────────────────────────────────────────────────────────────
  describe("getBuyQuote", () => {
    let sdk: GoodReserveSDK
    let mockReadContract: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockReadContract = makeMentoReadContract(CELO_PROD_STABLE, CELO_PROD_GD)
      sdk = new GoodReserveSDK(
        makeMockClient({ readContract: mockReadContract } as any),
      )
    })

    it("returns the quoted G$ amount on Celo via Mento broker", async () => {
      const result = await sdk.getBuyQuote(CELO_PROD_STABLE, 100n)
      expect(result).toBe(500n)
      expect(mockReadContract).toHaveBeenCalled()
    })

    it("returns quoted amount on XDC via Mento broker", async () => {
      const rc = makeMentoReadContract(XDC_DEV_STABLE, XDC_DEV_GD, 700n)
      const xdcSdk = new GoodReserveSDK(
        makeMockClient({
          chain: { id: XDC_CHAIN_ID },
          readContract: rc,
        } as any),
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
      const sdk = new GoodReserveSDK(
        makeMockClient({ readContract: rc } as any),
      )
      expect(await sdk.getSellQuote(100n, CELO_PROD_STABLE)).toBe(88n)
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
        new GoodReserveSDK(makeMockClient(), {} as any).buy(
          CELO_PROD_STABLE,
          0n,
          0n,
        ),
      ).rejects.toThrow("amountIn must be greater than zero")
    })

    it("approves then calls swapIn on Mento broker", async () => {
      const rc = makeMentoReadContract(CELO_PROD_STABLE, CELO_PROD_GD)
      const simulateContract = vi.fn().mockResolvedValue({ request: {} })
      const wc = makeMockWallet()
      const publicClient = makeMockClient({
        readContract: rc,
        simulateContract,
      } as any)

      const sdk = new GoodReserveSDK(publicClient, wc)
      const result = await sdk.buy(CELO_PROD_STABLE, 100n, 90n)

      expect(result.hash).toBe(MOCK_TX_HASH)
      // Should fire twice: once for the approval, once for swapIn
      expect(simulateContract).toHaveBeenCalledTimes(2)
      expect(simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "swapIn" }),
      )
    })

    it("exactApproval=true approves the exact required amount", async () => {
      const rc = makeMentoReadContract(CELO_PROD_STABLE, CELO_PROD_GD)
      const simulateContract = vi.fn().mockResolvedValue({ request: {} })
      const wc = makeMockWallet()
      const publicClient = makeMockClient({
        readContract: rc,
        simulateContract,
      } as any)

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
    it("throws for negative minReturn", async () => {
      const wc = makeMockWallet()
      const sdk = new GoodReserveSDK(makeMockClient(), wc)
      await expect(sdk.buy(CELO_PROD_STABLE, 100n, -1n)).rejects.toThrow(
        "minReturn cannot be negative",
      )
    })

    it("does not approve when allowance is already sufficient", async () => {
      const rc = vi.fn().mockImplementation(
        makeAsyncFn((req) => {
          const fn = String(req.functionName)
          if (fn === "getExchangeIds") return [MOCK_EXCHANGE_ID]
          if (fn === "getPoolExchange")
            return [CELO_PROD_STABLE, CELO_PROD_GD, 0n, 0n, 1, 1]
          if (fn === "getAmountOut") return 500n
          // Return a large allowance so no approval should fire
          if (fn === "allowance") return 10_000_000n
          return 0n
        }),
      )
      const simulateContract = vi.fn().mockResolvedValue({ request: {} })
      const wc = makeMockWallet()
      const publicClient = makeMockClient({
        readContract: rc,
        simulateContract,
      } as any)

      const result = await new GoodReserveSDK(publicClient, wc).buy(
        CELO_PROD_STABLE,
        100n,
        90n,
      )

      expect(result.hash).toBe(MOCK_TX_HASH)
      // Only swapIn — no approve
      expect(simulateContract).toHaveBeenCalledTimes(1)
      expect(simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "swapIn" }),
      )
      for (const [args] of simulateContract.mock.calls as any[]) {
        expect((args as any).functionName).not.toBe("approve")
      }
    })

    it("reads allowance at the approval block before swapIn", async () => {
      let allowanceReads = 0
      const rc = vi.fn().mockImplementation(
        makeAsyncFn((req) => {
          const fn = String(req.functionName)
          if (fn === "getExchangeIds") return [MOCK_EXCHANGE_ID]
          if (fn === "getPoolExchange")
            return [CELO_PROD_STABLE, CELO_PROD_GD, 0n, 0n, 1, 1]
          if (fn === "allowance") {
            allowanceReads += 1
            if (allowanceReads === 1) return 0n
            if (req.blockNumber === MOCK_BLOCK_NUMBER) return 100n
            return 0n
          }
          return 0n
        }),
      )
      const simulateContract = vi.fn().mockResolvedValue({ request: {} })
      const wc = makeMockWallet()
      const publicClient = makeMockClient({
        readContract: rc,
        simulateContract,
      } as any)

      const result = await new GoodReserveSDK(publicClient, wc).buy(
        CELO_PROD_STABLE,
        100n,
        90n,
      )

      expect(result.hash).toBe(MOCK_TX_HASH)
      expect(rc).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "allowance",
          blockNumber: MOCK_BLOCK_NUMBER,
        }),
      )
      expect(simulateContract).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ functionName: "approve" }),
      )
      expect(simulateContract).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ functionName: "swapIn" }),
      )
    })

    it("throws when the approved allowance is not visible at the approval block", async () => {
      const rc = vi.fn().mockImplementation(
        makeAsyncFn((req) => {
          const fn = String(req.functionName)
          if (fn === "getExchangeIds") return [MOCK_EXCHANGE_ID]
          if (fn === "getPoolExchange")
            return [CELO_PROD_STABLE, CELO_PROD_GD, 0n, 0n, 1, 1]
          if (fn === "allowance") return 0n
          return 0n
        }),
      )
      const simulateContract = vi.fn().mockResolvedValue({ request: {} })
      const wc = makeMockWallet()
      const publicClient = makeMockClient({
        readContract: rc,
        simulateContract,
      } as any)

      vi.useFakeTimers()
      try {
        const assertion = expect(
          new GoodReserveSDK(publicClient, wc).buy(CELO_PROD_STABLE, 100n, 90n),
        ).rejects.toThrow(
          "Approved allowance not visible at the approval block.",
        )
        await vi.runAllTimersAsync()
        await assertion
      } finally {
        vi.useRealTimers()
      }

      expect(simulateContract).toHaveBeenCalledTimes(1)
      expect(simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "approve" }),
      )
    })

    it("retries the pinned read when a lagging node rejects it", async () => {
      // forno load-balances across nodes, so the one serving this read may be
      // behind the approval block ("block is out of range") or may no longer
      // hold its state ("historical state is not available").
      let pinnedReads = 0
      const rc = vi.fn().mockImplementation((req: any) => {
        const fn = String(req.functionName)
        if (fn === "getExchangeIds") return Promise.resolve([MOCK_EXCHANGE_ID])
        if (fn === "getPoolExchange")
          return Promise.resolve([CELO_PROD_STABLE, CELO_PROD_GD, 0n, 0n, 1, 1])
        if (fn === "allowance") {
          // The pre-approval check in ensureAllowance reads at head.
          if (req.blockNumber === undefined) return Promise.resolve(0n)
          pinnedReads += 1
          return pinnedReads < 3
            ? Promise.reject(new Error("block is out of range"))
            : Promise.resolve(100n)
        }
        return Promise.resolve(0n)
      })
      const simulateContract = vi.fn().mockResolvedValue({ request: {} })
      const wc = makeMockWallet()
      const publicClient = makeMockClient({
        readContract: rc,
        simulateContract,
      } as any)

      vi.useFakeTimers()
      try {
        const pending = new GoodReserveSDK(publicClient, wc).buy(
          CELO_PROD_STABLE,
          100n,
          90n,
        )
        await vi.runAllTimersAsync()
        const result = await pending
        expect(result.hash).toBe(MOCK_TX_HASH)
      } finally {
        vi.useRealTimers()
      }

      expect(pinnedReads).toBe(3)
      expect(simulateContract).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ functionName: "swapIn" }),
      )
    })

    it("exhausts every attempt when the pinned read keeps failing", async () => {
      let pinnedReads = 0
      const rc = vi.fn().mockImplementation((req: any) => {
        const fn = String(req.functionName)
        if (fn === "getExchangeIds") return Promise.resolve([MOCK_EXCHANGE_ID])
        if (fn === "getPoolExchange")
          return Promise.resolve([CELO_PROD_STABLE, CELO_PROD_GD, 0n, 0n, 1, 1])
        if (fn === "allowance") {
          if (req.blockNumber === undefined) return Promise.resolve(0n)
          pinnedReads += 1
          return Promise.reject(new Error("block is out of range"))
        }
        return Promise.resolve(0n)
      })
      const simulateContract = vi.fn().mockResolvedValue({ request: {} })
      const wc = makeMockWallet()
      const publicClient = makeMockClient({
        readContract: rc,
        simulateContract,
      } as any)

      vi.useFakeTimers()
      try {
        const assertion = expect(
          new GoodReserveSDK(publicClient, wc).buy(CELO_PROD_STABLE, 100n, 90n),
        ).rejects.toThrow(
          "Approved allowance not visible at the approval block.",
        )
        await vi.runAllTimersAsync()
        await assertion
      } finally {
        vi.useRealTimers()
      }

      // An RPC failure must consume a retry rather than abort the whole swap.
      expect(pinnedReads).toBe(20)
      expect(simulateContract).toHaveBeenCalledTimes(1)
    })

    it("throws when the approval receipt is reverted", async () => {
      mockedWaitForTransactionReceipt.mockResolvedValueOnce({
        transactionHash: MOCK_TX_HASH,
        status: "reverted",
        blockNumber: MOCK_BLOCK_NUMBER,
      } as Awaited<ReturnType<typeof waitForTransactionReceipt>>)

      const rc = makeMentoReadContract(CELO_PROD_STABLE, CELO_PROD_GD)
      const simulateContract = vi.fn().mockResolvedValue({ request: {} })
      const wc = makeMockWallet()
      const publicClient = makeMockClient({
        readContract: rc,
        simulateContract,
      } as any)

      await expect(
        new GoodReserveSDK(publicClient, wc).buy(CELO_PROD_STABLE, 100n, 90n),
      ).rejects.toThrow("Approval transaction reverted on-chain.")
      expect(simulateContract).toHaveBeenCalledTimes(1)
      expect(simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "approve" }),
      )
    })

  })

  // ── sell ─────────────────────────────────────────────────────────────────────
  describe("sell", () => {
    it("throws when no wallet client is provided", async () => {
      await expect(
        new GoodReserveSDK(makeMockClient()).sell(CELO_PROD_STABLE, 100n, 90n),
      ).rejects.toThrow("wallet client is required")
    })

    it("throws for zero gdAmount", async () => {
      await expect(
        new GoodReserveSDK(makeMockClient(), {} as any).sell(
          CELO_PROD_STABLE,
          0n,
          0n,
        ),
      ).rejects.toThrow("gdAmount must be greater than zero")
    })

    it("approves then calls swapIn on Mento broker", async () => {
      const rc = makeMentoReadContract(CELO_PROD_STABLE, CELO_PROD_GD)
      const simulateContract = vi.fn().mockResolvedValue({ request: {} })
      const wc = makeMockWallet()
      const publicClient = makeMockClient({
        readContract: rc,
        simulateContract,
      } as any)

      const sdk = new GoodReserveSDK(publicClient, wc)
      const result = await sdk.sell(CELO_PROD_STABLE, 100n, 90n)

      expect(result.hash).toBe(MOCK_TX_HASH)
      // Should fire twice: once for the approval, once for swapIn
      expect(simulateContract).toHaveBeenCalledTimes(2)
      expect(simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "swapIn",
          // tokenIn must be G$, tokenOut must be the sellTo token.
          args: expect.arrayContaining([CELO_PROD_GD, CELO_PROD_STABLE]),
        }),
      )

      const approveCall = simulateContract.mock.calls.find(
        ([p]: any[]) => p?.functionName === "approve",
      )
      expect(approveCall).toBeDefined()
      expect(approveCall![0].args[1]).toBe(100n)
    })
    it("throws for negative minReturn", async () => {
      const wc = makeMockWallet()
      const sdk = new GoodReserveSDK(makeMockClient(), wc)
      await expect(sdk.sell(CELO_PROD_STABLE, 100n, -1n)).rejects.toThrow(
        "minReturn cannot be negative",
      )
    })
  })

  // ── getTransactionHistory ────────────────────────────────────────────────────
  describe("getTransactionHistory", () => {
    it("returns empty array when no events found", async () => {
      const rc = makeMentoReadContract(CELO_PROD_STABLE, CELO_PROD_GD)
      const sdk = new GoodReserveSDK(
        makeMockClient({ readContract: rc } as any),
      )
      const result = await sdk.getTransactionHistory(
        "0x0000000000000000000000000000000000000001",
      )
      expect(result).toEqual([])
    })

    it.each(["production", "development"] as const)("decodes XDC %s broker Swap events correctly", async (env) => {
      const route = RESERVE_CONTRACT_ADDRESSES[env].xdc
      const rc = makeMentoReadContract(route.stableToken, route.goodDollar)
      const mockGetContractEvents = vi.fn().mockResolvedValue([
        {
          args: {
            exchangeId: MOCK_EXCHANGE_ID,
            trader: "0x0000000000000000000000000000000000000001",
            tokenIn: route.stableToken,
            tokenOut: route.goodDollar,
            amountIn: 100n,
            amountOut: 250n,
          },
          transactionHash: MOCK_TX_HASH,
          blockNumber: 900n,
        },
        {
          args: {
            tokenIn: route.goodDollar,
            tokenOut: route.stableToken,
            amountIn: 250n,
            amountOut: 90n,
          },
          transactionHash: MOCK_TX_HASH,
          blockNumber: 901n,
        },
      ])

      const sdk = new GoodReserveSDK(
        makeMockClient({
          chain: { id: XDC_CHAIN_ID },
          readContract: rc,
          getContractEvents: mockGetContractEvents,
        } as any),
        undefined,
        env,
      )
      const result = await sdk.getTransactionHistory(
        "0x0000000000000000000000000000000000000001",
      )
      expect(result).toHaveLength(2)
      expect(result[0]?.type).toBe("buy")
      expect(result[0]?.amountOut).toBe(250n)
      expect(result[1]?.type).toBe("sell")
      expect(result[1]?.amountOut).toBe(90n)
      expect(mockGetContractEvents).toHaveBeenCalledWith(expect.objectContaining({
        address: route.broker,
        args: { exchangeId: MOCK_EXCHANGE_ID, trader: "0x0000000000000000000000000000000000000001" },
      }))
    })


    it("enriches events with timestamps and sorts chronologically", async () => {
      const rc = makeMentoReadContract(CELO_PROD_STABLE, CELO_PROD_GD)

      const getContractEvents = vi.fn().mockResolvedValue([
        {
          args: {
            exchangeId: MOCK_EXCHANGE_ID,
            trader: "0x0000000000000000000000000000000000000001",
            tokenIn: CELO_PROD_STABLE,
            tokenOut: CELO_PROD_GD,
            amountIn: 10n,
            amountOut: 50n,
          },
          transactionHash:
            "0x0000000000000000000000000000000000000000000000000000000000000003" as `0x${string}`,
          blockNumber: 12n,
        },
        {
          args: {
            exchangeId: MOCK_EXCHANGE_ID,
            trader: "0x0000000000000000000000000000000000000001",
            tokenIn: CELO_PROD_STABLE,
            tokenOut: CELO_PROD_GD,
            amountIn: 5n,
            amountOut: 25n,
          },
          transactionHash:
            "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`,
          blockNumber: 10n,
        },
        {
          args: {
            exchangeId: MOCK_EXCHANGE_ID,
            trader: "0x0000000000000000000000000000000000000001",
            tokenIn: CELO_PROD_STABLE,
            tokenOut: CELO_PROD_GD,
            amountIn: 7n,
            amountOut: 35n,
          },
          transactionHash:
            "0x0000000000000000000000000000000000000000000000000000000000000002" as `0x${string}`,
          blockNumber: 11n,
        },
      ])

      const getBlock = vi.fn(
        async ({ blockNumber }: { blockNumber: bigint }) => ({
          number: blockNumber,
          timestamp:
            blockNumber === 10n ? 1000n : blockNumber === 11n ? 2000n : 3000n,
        }),
      )

      const sdk = new GoodReserveSDK(
        makeMockClient({
          readContract: rc,
          getContractEvents,
          getBlock,
        } as any),
      )
      const result = await sdk.getTransactionHistory(
        "0x0000000000000000000000000000000000000001",
      )

      // Should be sorted ascending by block
      expect(result.map((e) => e.block)).toEqual([10n, 11n, 12n])
      // Timestamps should match the per-block mock values
      expect(result.map((e) => (e as any).timestamp)).toEqual([
        1000, 2000, 3000,
      ])
    })
  })

  // ── reserve diagnostics ───────────────────────────────────────────────────────
  describe("reserve diagnostics", () => {
    it("reads production XDC stats without changing normalized pool or token-native units", async () => {
      const readContract = vi.fn().mockImplementation(makeAsyncFn((req) => {
        if (req.functionName === "getExchangeIds") return [MOCK_EXCHANGE_ID]
        if (req.functionName === "getPoolExchange") {
          return [XDC_PROD_STABLE, XDC_PROD_GD, 2n * 10n ** 18n, 10n ** 18n, 50_000_000, 1_000_000]
        }
        if (req.functionName === "totalSupply") return 3n * 10n ** 18n
        if (req.functionName === "decimals") return req.address === XDC_PROD_STABLE ? 6 : 18
        return 0n
      }))
      const sdk = new GoodReserveSDK(makeMockClient({
        chain: { id: XDC_CHAIN_ID }, readContract,
      } as any))
      const stats = await sdk.getReserveStats()
      expect(stats).toEqual({
        goodDollarTotalSupply: 3n * 10n ** 18n,
        stableTokenDecimals: 6,
        goodDollarDecimals: 18,
        poolReserveBalance: 10n ** 18n,
        poolTokenSupply: 2n * 10n ** 18n,
        reserveRatio: 50_000_000,
        exitContribution: 1_000_000,
      })
      expect(readContract).toHaveBeenCalledWith(expect.objectContaining({
        address: XDC_PROD_PROVIDER, functionName: "getPoolExchange",
      }))
      expect(normalizeReserveStats(stats).poolReserveBalance).toBe("1")
    })

    it("returns route info with active mento addresses", () => {
      const info = new GoodReserveSDK(makeMockClient()).getRouteInfo()
      expect(info.chainId).toBe(CELO_CHAIN_ID)
      expect(info.mode).toBe("mento-broker")
      expect(info.broker).toBe(
        RESERVE_CONTRACT_ADDRESSES.production.celo.broker,
      )
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
            return [
              CELO_PROD_STABLE,
              CELO_PROD_GD,
              2000000n,
              350000n,
              500000,
              0,
            ]
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

  })


  // ── parallel pool discovery ───────────────────────────────────────────────────
  describe("parallel pool discovery", () => {
    it("fans out getPoolExchange calls for multiple exchange ids", async () => {
      const EXCHANGE_ID_2 =
        "0x0000000000000000000000000000000000000000000000000000000000002222" as `0x${string}`
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

      // Make sure both pool reads were kicked off (proves the concurrent fan-out works)
      expect(poolCallIds).toContain(MOCK_EXCHANGE_ID)
      expect(poolCallIds).toContain(EXCHANGE_ID_2)
      expect(result).toBe(123n)
    })
  })

  // ── isChainEnvSupported ───────────────────────────────────────────────────────
  describe("isChainEnvSupported", () => {
    it("returns true for Celo production", () => {
      expect(
        GoodReserveSDK.isChainEnvSupported(CELO_CHAIN_ID, "production"),
      ).toBe(true)
    })

    it("returns true for XDC development (Mento broker active)", () => {
      expect(
        GoodReserveSDK.isChainEnvSupported(XDC_CHAIN_ID, "development"),
      ).toBe(true)
    })

    it("returns true for XDC production", () => {
      expect(
        GoodReserveSDK.isChainEnvSupported(XDC_CHAIN_ID, "production"),
      ).toBe(true)
    })

    describe("normalizeReserveStats", () => {
      const raw: ReserveStats = {
        goodDollarTotalSupply: 123456789n,
        stableTokenDecimals: 6,
        goodDollarDecimals: 18,
        poolReserveBalance: 10n ** 18n,
        poolTokenSupply: 2n * 10n ** 18n,
        reserveRatio: 50_000_000,
        exitContribution: 1_000_000,
      }

      it("uses percent and normalized pool units, not the stable token's 6 decimals", () => {
        expect(normalizeReserveStats(raw)).toEqual({
          reserveRatioPercent: "50",
          exitContributionPercent: "1",
          poolReserveBalance: "1",
          poolTokenSupply: "2",
        })
        expect(raw.poolReserveBalance).toBe(10n ** 18n)
      })

      it.each([
        [0, "0"],
        [1, "0.000001"],
        [1_234_567, "1.234567"],
        [100_000_000, "100"],
        [null, null],
      ])("converts raw percentage %s exactly", (value, expected) => {
        expect(normalizeReserveStats({
          ...raw, reserveRatio: value, exitContribution: value,
        })).toMatchObject({
          reserveRatioPercent: expected,
          exitContributionPercent: expected,
        })
      })

      it("preserves null pool amounts and large bigint precision", () => {
        expect(normalizeReserveStats({
          ...raw,
          poolReserveBalance: 123456789012345678901234567890123456n,
          poolTokenSupply: null,
        })).toMatchObject({
          poolReserveBalance: "123456789012345678.901234567890123456",
          poolTokenSupply: null,
        })
      })
    })

    it("returns false for an unsupported chain id", () => {
      expect(GoodReserveSDK.isChainEnvSupported(1, "production")).toBe(false)
    })
  })

  // ── read helpers ──────────────────────────────────────────────────────────────
  describe("read helpers", () => {
    it("getGDBalance calls balanceOf on the goodDollar contract", async () => {
      const rc = vi.fn().mockResolvedValue(9999n)
      const sdk = new GoodReserveSDK(
        makeMockClient({ readContract: rc } as any),
      )
      const balance = await sdk.getGDBalance(
        "0x0000000000000000000000000000000000000001",
      )
      expect(balance).toBe(9999n)
      expect(rc).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "balanceOf" }),
      )
    })

    it("getTokenDecimals returns the numeric decimals value", async () => {
      const rc = vi.fn().mockResolvedValue(6)
      const sdk = new GoodReserveSDK(
        makeMockClient({ readContract: rc } as any),
      )
      const decimals = await sdk.getTokenDecimals(CELO_PROD_STABLE)
      expect(decimals).toBe(6)
    })

    it("getStableTokenAddress returns the configured stable token", () => {
      const sdk = new GoodReserveSDK(makeMockClient())
      expect(sdk.getStableTokenAddress()).toBe(CELO_PROD_STABLE)
    })

    it("getGoodDollarAddress returns the configured G$ token", () => {
      const sdk = new GoodReserveSDK(makeMockClient())
      expect(sdk.getGoodDollarAddress()).toBe(CELO_PROD_GD)
    })
  })

  // ── no-account edge case ──────────────────────────────────────────────────────
  describe("no-account edge case", () => {
    it("throws 'No account found' when wallet returns an empty address list", async () => {
      const rc = makeMentoReadContract(CELO_PROD_STABLE, CELO_PROD_GD)
      const wc = {
        getAddresses: vi.fn().mockResolvedValue([]),
        writeContract: vi.fn(),
      } as unknown as import("viem").WalletClient

      const sdk = new GoodReserveSDK(
        makeMockClient({ readContract: rc } as any),
        wc,
      )
      await expect(sdk.buy(CELO_PROD_STABLE, 100n, 90n)).rejects.toThrow(
        "No account found in wallet client",
      )
    })
  })
})

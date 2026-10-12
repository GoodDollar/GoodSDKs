import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { parseUnits } from "viem"
import type { PublicClient, TransactionReceipt, WalletClient } from "viem"
import { BridgingSDK } from "../src/viem-sdk"
import { SUPPORTED_CHAINS } from "../src/constants"
import type { BridgeProtocol, BridgeQuote, BridgeRoute } from "../src/types"

const SENDER = "0x1111111111111111111111111111111111111111" as const
const TX_HASH = `0x${"ab".repeat(32)}` as const
const LIMITS = [1000n, 200n, 300n, 1n, true] as const
const ROUTE: BridgeRoute = { fromChain: 42220, toChain: 1, protocol: "AXELAR" }

function makeSdk(fromChain = 42220) {
  const decimals = SUPPORTED_CHAINS[fromChain].decimals
  const state = {
    tokenBalance: parseUnits("100", decimals),
    nativeBalance: parseUnits("1", 18),
    allowance: parseUnits("100", decimals),
    isWithinLimit: true,
    limitError: "",
    rejectFee: false,
    rejectLimits: false,
    rates: new Map([[42220, 700n], [1, 10n], [122, 25n], [50, 30n]]),
  }
  const clients = Object.fromEntries(Object.keys(SUPPORTED_CHAINS).map(id => {
    const chainId = Number(id)
    return [chainId, {
      chain: { id: chainId },
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        switch (functionName) {
          case "balanceOf": return state.tokenBalance
          case "allowance": return state.allowance
          case "canBridge": return [state.isWithinLimit, state.limitError]
          case "bridgeLimits":
            if (state.rejectLimits) throw new Error("limits RPC failed")
            return LIMITS
          case "bridgeFees":
            if (state.rejectFee) throw new Error("fee RPC failed")
            // minFee and maxFee deliberately do not match the calculated fee.
            return [999n, 1n, state.rates.get(chainId)]
          default: throw new Error(`Unexpected read: ${functionName}`)
        }
      }),
      getBalance: vi.fn(async () => state.nativeBalance),
    }]
  }))
  const sdk = new BridgingSDK(
    clients[fromChain] as unknown as PublicClient,
    undefined,
    fromChain,
    clients as unknown as Record<number, PublicClient>,
  )
  const params = {
    sender: SENDER,
    amount: parseUnits("1", decimals),
    ...ROUTE,
    fromChain,
    toChain: fromChain === 1 ? 42220 : 1,
  }
  const configReads = (chainId: number, functionName: string) =>
    clients[chainId].readContract.mock.calls.filter(([call]) => call.functionName === functionName)
  return { sdk, state, clients, params, configReads }
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => ({
      AXELAR: {
        AXL_CELO_TO_ETH: "0.01 CELO",
        AXL_ETH_TO_CELO: "0.01 ETH",
      },
      LAYERZERO: {
        LZ_CELO_TO_ETH: "0.01 CELO",
        LZ_CELO_TO_FUSE: "0.01 CELO",
        LZ_FUSE_TO_XDC: "0.01 FUSE",
        LZ_CELO_TO_XDC: "0.01 CELO",
      },
    }),
  })))
})

afterEach(() => vi.unstubAllGlobals())

describe("destination protocol fees", () => {
  it("uses the destination rate, truncating destination units before the fee", async () => {
    const { sdk, params, configReads } = makeSdk()
    const result = await sdk.getQuote({ ...params, amount: parseUnits("10.019999999999999999", 18) })
    expect(result.canBridge).toBe(true)
    expect(result.quote).toMatchObject({
      protocolFeeBps: 10n,
      protocolFee: 1n,
      amountReceived: 1000n,
      fee: parseUnits("0.011", 18),
    })
    expect(configReads(42220, "bridgeFees")).toHaveLength(0)
    expect(configReads(1, "bridgeFees")).toHaveLength(1)
  })

  it("rounds a fractional destination fee down, not the net amount", async () => {
    const { sdk, params } = makeSdk()
    const { quote } = await sdk.getQuote(params)
    expect(quote).toMatchObject({ protocolFee: 0n, amountReceived: 100n })
  })

  it("converts 2-decimal source tokens into 18-decimal destination units", async () => {
    const { sdk, params } = makeSdk(1)
    const { quote } = await sdk.getQuote({ ...params, amount: 101n })
    const gross = parseUnits("1.01", 18)
    expect(quote).toMatchObject({
      protocolFeeBps: 700n,
      protocolFee: gross * 700n / 10000n,
      amountReceived: gross - gross * 700n / 10000n,
    })
  })

  it("handles equal decimals and zero or 100% rates without min/max clamps", async () => {
    const { sdk, state, params } = makeSdk()
    state.rates.set(50, 0n)
    const route = { ...params, toChain: 50, protocol: "LAYERZERO" as const }
    expect((await sdk.getQuote(route)).quote).toMatchObject({
      protocolFee: 0n,
      amountReceived: params.amount,
    })
    state.rates.set(50, 10000n)
    expect((await sdk.getQuote({ ...route, refresh: true })).quote).toMatchObject({
      protocolFee: params.amount,
      amountReceived: 0n,
    })
  })
})

describe("route configuration cache", () => {
  it("returns source limits and destination rate; amount-only updates reuse reads", async () => {
    const { sdk, params, configReads } = makeSdk()
    const config = await sdk.getBridgeConfig(SENDER, ROUTE)
    expect(config).toMatchObject({
      routeLimitsChainId: 42220,
      routeLimits: {
        dailyLimit: 1000n, txLimit: 200n, accountDailyLimit: 300n,
        minAmount: 1n, onlyWhitelisted: true,
      },
      protocolFeeChainId: 1,
      protocolFeeBps: 10n,
    })
    await sdk.getQuote(params)
    const { quote } = await sdk.getQuote({ ...params, amount: parseUnits("20", 18) })
    expect(quote).toMatchObject({ protocolFee: 2n, amountReceived: 1998n })
    expect(configReads(42220, "bridgeLimits")).toHaveLength(1)
    expect(configReads(1, "bridgeFees")).toHaveLength(1)
  })

  it("keeps the address-only config API and exposes current-chain limits", async () => {
    const { sdk, configReads } = makeSdk()
    const config = await sdk.getBridgeConfig(SENDER)
    expect(config.routeLimits?.txLimit).toBe(200n)
    expect(config.routeLimitsChainId).toBe(42220)
    expect(config.protocolFeeBps).toBeNull()
    expect(config.protocolFeeChainId).toBeNull()
    expect(configReads(1, "bridgeFees")).toHaveLength(0)
  })

  it("reloads on destination/protocol changes, including returning to a previous route", async () => {
    const { sdk, params, configReads } = makeSdk()
    await sdk.getQuote(params)
    await sdk.getQuote({ ...params, protocol: "LAYERZERO" })
    const fuse = await sdk.getQuote({ ...params, toChain: 122, protocol: "LAYERZERO" })
    expect(fuse.quote?.protocolFeeBps).toBe(25n)
    await sdk.getQuote(params)
    expect(configReads(42220, "bridgeLimits")).toHaveLength(4)
    expect(configReads(1, "bridgeFees")).toHaveLength(3)
    expect(configReads(122, "bridgeFees")).toHaveLength(1)
  })

  it("uses refreshed config for the final quote and shares explicit config refresh", async () => {
    const { sdk, state, params, configReads } = makeSdk()
    await sdk.getQuote(params)
    state.rates.set(1, 100n)
    expect((await sdk.getQuote(params)).quote?.protocolFeeBps).toBe(10n)
    expect((await sdk.getQuote({ ...params, refresh: true })).quote).toMatchObject({
      protocolFeeBps: 100n, protocolFee: 1n, amountReceived: 99n,
    })
    state.rates.set(1, 200n)
    await sdk.getBridgeConfig(SENDER, ROUTE, { refresh: true })
    expect((await sdk.getQuote(params)).quote?.protocolFeeBps).toBe(200n)
    expect(configReads(42220, "bridgeLimits")).toHaveLength(3)
    expect(configReads(1, "bridgeFees")).toHaveLength(3)
  })

  it("deduplicates concurrent configuration loads", async () => {
    const { sdk, params, configReads } = makeSdk()
    await Promise.all([sdk.getQuote(params), sdk.getQuote(params)])
    expect(configReads(42220, "bridgeLimits")).toHaveLength(1)
    expect(configReads(1, "bridgeFees")).toHaveLength(1)
  })

  it.each(["rejectFee", "rejectLimits"] as const)("surfaces %s and retries, including after a failed refresh", async failure => {
    const { sdk, state, params } = makeSdk()
    state[failure] = true
    const unavailable = await sdk.getQuote(params)
    expect(unavailable).toMatchObject({
      quote: null, canBridge: false,
      requirements: [{ type: "route_unavailable" }],
    })
    await expect(sdk.getBridgeConfig(SENDER, ROUTE)).rejects.toThrow("RPC failed")
    state[failure] = false
    expect((await sdk.getQuote(params)).canBridge).toBe(true)
    state[failure] = true
    expect((await sdk.getQuote({ ...params, refresh: true })).quote).toBeNull()
    expect((await sdk.getQuote(params)).quote).toBeNull()
    state[failure] = false
    expect((await sdk.getQuote(params)).canBridge).toBe(true)
  })

  it("rejects a destination client bound to the wrong chain", async () => {
    const { sdk, clients, params } = makeSdk()
    clients[1].chain.id = 42220
    const result = await sdk.getQuote(params)
    expect(result.quote).toBeNull()
    expect(result.requirements[0].message).toContain("Public client chain does not match")
  })
})

describe("live amount-dependent validation", () => {
  it("rechecks balances, native fee, allowance and canBridge without rereading configuration", async () => {
    const { sdk, state, params, configReads, clients } = makeSdk()
    state.tokenBalance = params.amount
    state.allowance = 0n
    expect(await sdk.getQuote(params)).toMatchObject({ canBridge: true, needsApproval: true })
    state.nativeBalance = 0n
    state.isWithinLimit = false
    state.limitError = "accountDailyLimit"
    const blocked = await sdk.getQuote({ ...params, amount: params.amount * 2n })
    expect(blocked.canBridge).toBe(false)
    expect(blocked.requirements.map(r => r.type)).toEqual([
      "insufficient_token_balance", "insufficient_native_balance", "exceeds_limit",
    ])
    state.allowance = params.amount
    state.nativeBalance = parseUnits("1", 18)
    state.isWithinLimit = true
    expect(await sdk.getQuote(params)).toMatchObject({ canBridge: true, needsApproval: false })
    expect(configReads(42220, "bridgeLimits")).toHaveLength(1)
    expect(configReads(42220, "canBridge")).toHaveLength(3)
    expect(clients[42220].getBalance).toHaveBeenCalledTimes(3)
    expect(configReads(42220, "balanceOf")).toHaveLength(3)
    expect(configReads(42220, "allowance")).toHaveLength(3)
  })

  it("retains normalized source canBridge checks on 2-decimal chains", async () => {
    const { sdk, params, clients } = makeSdk(1)
    await sdk.getQuote({ ...params, amount: 101n })
    expect(clients[1].readContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: "canBridge",
      args: [SENDER, parseUnits("1.01", 18)],
    }))
  })

  it("preserves provider restrictions and GoodServer route validation", async () => {
    const { sdk, params } = makeSdk()
    expect((await sdk.getQuote({ ...params, toChain: 122 })).requirements[0].type).toBe("route_unavailable")
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ AXELAR: {} }) })))
    await sdk.initialize()
    expect((await sdk.getQuote(params)).requirements[0].message).toContain("No fee data available for route")
  })

  it("still blocks a mismatched source chain", async () => {
    const { sdk, params } = makeSdk()
    const result = await sdk.getQuote({ ...params, fromChain: 1, toChain: 42220 })
    expect(result.canBridge).toBe(false)
    expect(result.requirements).toContainEqual(expect.objectContaining({ type: "wrong_chain" }))
  })
})

describe("delivery tracking", () => {
  it.each([
    ["LAYERZERO", "FAILED", "failed"], ["LAYERZERO", "DELIVERED", "completed"],
    ["LAYERZERO", "INFLIGHT", "pending"], ["AXELAR", "failed", "failed"],
    ["AXELAR", "executed", "completed"], ["AXELAR", "pending", "pending"],
  ] as const)("maps %s %s to %s", async (protocol, providerStatus, expected) => {
    const { sdk } = makeSdk()
    vi.stubGlobal("fetch", vi.fn(async () => ({
      json: async () => ({
        data: protocol === "LAYERZERO" ? [{
          status: { name: providerStatus }, source: { tx: { txHash: TX_HASH } },
          created: "2026-10-12T00:00:00Z",
        }] : [{
          status: providerStatus, sourceTxHash: TX_HASH, createdAt: "2026-10-12T00:00:00Z",
        }],
      }),
    })))
    expect(await sdk.getTransactionStatus(TX_HASH, protocol)).toMatchObject({
      status: expected, srcTxHash: TX_HASH,
    })
  })

  it.each(["AXELAR", "LAYERZERO"] as BridgeProtocol[])("keeps missing %s delivery records pending", async protocol => {
    const { sdk } = makeSdk()
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ data: [] }) })))
    expect(await sdk.getTransactionStatus(TX_HASH, protocol)).toEqual({ status: "pending" })
  })

  it("accepts legacy quotes and reports source confirmation without implying delivery", async () => {
    const { sdk } = makeSdk()
    sdk.setWalletClient({
      chain: { id: 42220 }, getAddresses: async () => [SENDER],
    } as unknown as WalletClient)
    const quote: BridgeQuote = {
      amount: 1n, fee: 1n, feeInNative: "0.01 CELO",
      protocol: "AXELAR", target: SENDER, targetChainId: 1,
    }
    const receipt = { transactionHash: TX_HASH, status: "success" } as TransactionReceipt
    vi.spyOn(sdk, "bridgeTo").mockResolvedValue(receipt)
    const status = vi.fn()
    const delivery = vi.spyOn(sdk, "getTransactionStatus")
    expect(await sdk.doBridge(quote, status)).toBe(receipt)
    expect(status).toHaveBeenLastCalledWith(expect.objectContaining({
      step: "completed", bridgeTxHash: TX_HASH, receipt,
    }))
    expect(delivery).not.toHaveBeenCalled()
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ data: [] }) })))
    expect((await sdk.getTransactionStatus(TX_HASH, "AXELAR")).status).toBe("pending")
  })
})

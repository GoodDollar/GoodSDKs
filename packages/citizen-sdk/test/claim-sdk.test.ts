import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PublicClient, TransactionReceipt, WalletClient } from "viem"
import { ClaimSDK } from "../src/sdks/viem-claim-sdk"
import { SupportedChains } from "../src/constants"

vi.mock("viem/actions", () => ({
  waitForTransactionReceipt: vi.fn(async (_client, { hash }) => ({
    transactionHash: hash,
  })),
}))

const MOCK_ACCOUNT = "0x1111111111111111111111111111111111111111"
const MOCK_HASH = "0xdeadbeef" as `0x${string}`

type MockPublicClient = Pick<PublicClient, "simulateContract">
type MockWalletClient = Pick<
  WalletClient,
  "account" | "chain" | "getAddresses" | "writeContract"
>

describe("ClaimSDK claim callbacks", () => {
  let publicClient: MockPublicClient
  let walletClient: MockWalletClient
  let sdk: ClaimSDK

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    publicClient = {
      simulateContract: vi.fn().mockResolvedValue({ request: {} }),
    }

    walletClient = {
      account: { address: MOCK_ACCOUNT },
      chain: { id: SupportedChains.CELO },
      getAddresses: vi.fn().mockResolvedValue([MOCK_ACCOUNT]),
      writeContract: vi.fn().mockResolvedValue(MOCK_HASH),
    }

    sdk = new ClaimSDK({
      account: MOCK_ACCOUNT,
      publicClient: publicClient as PublicClient,
      walletClient: walletClient as WalletClient,
      identitySDK: {
        getWhitelistedRoot: vi.fn().mockResolvedValue({
          isWhitelisted: true,
          root: MOCK_ACCOUNT,
        }),
      } as any,
      env: "development",
    })

    vi.spyOn(sdk, "checkEntitlement").mockResolvedValue({
      amount: 1n,
      altClaimAvailable: false,
      altChainId: null,
      altAmount: null,
    })
    vi.spyOn(sdk, "checkBalanceWithRetry").mockResolvedValue(true)
  })

  it("calls onTransactionSubmitted once after claim submission and before confirmation", async () => {
    vi.useFakeTimers()
    const events: string[] = []
    const onTransactionSubmitted = vi.fn(() => {
      events.push("submitted")
    })

    const claimPromise = sdk
      .claim({ onTransactionSubmitted })
      .then((receipt) => {
        events.push("confirmed")
        return receipt as TransactionReceipt
      })

    await vi.waitFor(() => {
      expect(onTransactionSubmitted).toHaveBeenCalledWith(MOCK_HASH)
    })

    expect(onTransactionSubmitted).toHaveBeenCalledTimes(1)
    expect(events).toEqual(["submitted"])

    await vi.advanceTimersByTimeAsync(5000)

    const receipt = await claimPromise
    expect(receipt.transactionHash).toBe(MOCK_HASH)
    expect(events).toEqual(["submitted", "confirmed"])
  })

  it("swallows onTransactionSubmitted errors so claim still resolves", async () => {
    vi.useFakeTimers()
    const onTransactionSubmitted = vi
      .fn()
      .mockRejectedValue(new Error("ui callback failed"))

    const claimPromise = sdk.claim({ onTransactionSubmitted })

    await vi.waitFor(() => {
      expect(onTransactionSubmitted).toHaveBeenCalledTimes(1)
    })

    await vi.advanceTimersByTimeAsync(5000)

    await expect(claimPromise).resolves.toMatchObject({
      transactionHash: MOCK_HASH,
    })
  })

  it("supports legacy claim txConfirm and onTxHash callbacks", async () => {
    vi.useFakeTimers()
    const txConfirm = vi.fn()
    const onTxHash = vi.fn()

    const claimPromise = sdk.claim({ txConfirm, onTxHash })

    await vi.waitFor(() => {
      expect(onTxHash).toHaveBeenCalledWith(MOCK_HASH)
    })

    expect(sdk.checkBalanceWithRetry).toHaveBeenCalledWith(txConfirm)

    await vi.advanceTimersByTimeAsync(5000)
    await claimPromise
  })

  it("supports the lowercase onTxhash compatibility alias", async () => {
    vi.useFakeTimers()
    const onTxhash = vi.fn()

    const claimPromise = sdk.claim({ onTxhash })

    await vi.waitFor(() => {
      expect(onTxhash).toHaveBeenCalledWith(MOCK_HASH)
    })

    await vi.advanceTimersByTimeAsync(5000)
    await claimPromise
  })

  it("preserves the positional txConfirm callback signature", async () => {
    vi.useFakeTimers()
    const txConfirm = vi.fn()

    const claimPromise = sdk.claim(txConfirm)

    await vi.waitFor(() => {
      expect(sdk.checkBalanceWithRetry).toHaveBeenCalledWith(txConfirm)
    })

    await vi.advanceTimersByTimeAsync(5000)
    await claimPromise
  })
})

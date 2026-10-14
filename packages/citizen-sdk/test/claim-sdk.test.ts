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

  it("calls onClaimSubmitted once after claim submission and before confirmation", async () => {
    const events: string[] = []
    let confirmReceipt: (receipt: TransactionReceipt) => void = () => {}
    const receiptPromise = new Promise<TransactionReceipt>((resolve) => {
      confirmReceipt = resolve
    })
    const onClaimSubmitted = vi.fn(() => {
      events.push("submitted")
    })
    vi.spyOn(sdk, "submitAndWait").mockImplementation(
      async (_params, onSubmitted) => {
        await onSubmitted?.(MOCK_HASH)
        events.push("waiting")
        return receiptPromise
      },
    )

    const claimPromise = sdk
      .claim(undefined, onClaimSubmitted)
      .then((receipt) => {
        events.push("confirmed")
        return receipt as TransactionReceipt
      })

    await vi.waitFor(() => {
      expect(onClaimSubmitted).toHaveBeenCalledWith(MOCK_HASH)
    })

    expect(onClaimSubmitted).toHaveBeenCalledTimes(1)
    expect(events).toEqual(["submitted", "waiting"])

    confirmReceipt({ transactionHash: MOCK_HASH } as TransactionReceipt)

    const receipt = await claimPromise
    expect(receipt.transactionHash).toBe(MOCK_HASH)
    expect(events).toEqual(["submitted", "waiting", "confirmed"])
  })

  it("swallows onClaimSubmitted errors so claim still resolves", async () => {
    vi.useFakeTimers()
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const onClaimSubmitted = vi
      .fn()
      .mockRejectedValue(new Error("ui callback failed"))

    const claimPromise = sdk.claim(undefined, onClaimSubmitted)

    await vi.waitFor(() => {
      expect(onClaimSubmitted).toHaveBeenCalledTimes(1)
    })

    await vi.advanceTimersByTimeAsync(5000)

    await expect(claimPromise).resolves.toMatchObject({
      transactionHash: MOCK_HASH,
    })
    expect(warnSpy).toHaveBeenCalledWith(
      "[ClaimSDK] onClaimSubmitted callback failed",
      expect.any(Error),
    )
  })

  it("supports onConfirmFaucetTx and onClaimSubmitted callbacks", async () => {
    vi.useFakeTimers()
    const onConfirmFaucetTx = vi.fn()
    const onClaimSubmitted = vi.fn()

    const claimPromise = sdk.claim(onConfirmFaucetTx, onClaimSubmitted)

    await vi.waitFor(() => {
      expect(onClaimSubmitted).toHaveBeenCalledWith(MOCK_HASH)
    })

    expect(sdk.checkBalanceWithRetry).toHaveBeenCalledWith(onConfirmFaucetTx)

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

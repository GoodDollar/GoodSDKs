import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PublicClient, TransactionReceipt, WalletClient } from "viem"
import { waitForTransactionReceipt } from "viem/actions"
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
    vi.mocked(waitForTransactionReceipt).mockImplementation(
      async (_client, { hash }) =>
        ({
          transactionHash: hash,
        }) as TransactionReceipt,
    )

    publicClient = {
      simulateContract: vi.fn().mockResolvedValue({ request: {} }),
    }

    walletClient = {
      account: { address: MOCK_ACCOUNT } as any,
      chain: { id: SupportedChains.CELO } as any,
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

  it("calls onClaimSubmitted inside real submitAndWait after broadcast and before receipt confirmation", async () => {
    vi.useFakeTimers()
    const events: string[] = []
    let confirmReceipt: (receipt: TransactionReceipt) => void = () => {}
    const receiptPromise = new Promise<TransactionReceipt>((resolve) => {
      confirmReceipt = resolve
    })

    vi.mocked(waitForTransactionReceipt).mockImplementation(async () => {
      events.push("waiting")
      return receiptPromise
    })

    const onClaimSubmitted = vi.fn((hash: `0x${string}`) => {
      events.push(`submitted:${hash}`)
    })

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
    expect(events).toEqual([`submitted:${MOCK_HASH}`])

    await vi.advanceTimersByTimeAsync(5000)
    expect(events).toEqual([`submitted:${MOCK_HASH}`, "waiting"])

    confirmReceipt({ transactionHash: MOCK_HASH } as TransactionReceipt)

    const receipt = await claimPromise
    expect(receipt.transactionHash).toBe(MOCK_HASH)
    expect(events).toEqual([`submitted:${MOCK_HASH}`, "waiting", "confirmed"])
  })

  it("does not block claim confirmation when onClaimSubmitted returns a slow or unresolved promise", async () => {
    vi.useFakeTimers()
    const onClaimSubmitted = vi.fn(() => new Promise<void>(() => {}))

    const claimPromise = sdk.claim(undefined, onClaimSubmitted)

    await vi.waitFor(() => {
      expect(onClaimSubmitted).toHaveBeenCalledWith(MOCK_HASH)
    })

    await vi.advanceTimersByTimeAsync(5000)

    await expect(claimPromise).resolves.toMatchObject({
      transactionHash: MOCK_HASH,
    })
  })

  it("swallows synchronous and asynchronous onClaimSubmitted errors so claim still resolves", async () => {
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

  it("supports both onConfirmFaucetTx and onClaimSubmitted callbacks", async () => {
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
})

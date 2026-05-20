import { describe, expect, it, vi } from "vitest"
import type { PublicClient, WalletClient } from "viem"
import { ClaimSDK } from "../src/sdks/viem-claim-sdk"
import { SupportedChains } from "../src/constants"

const CONNECTED_ACCOUNT = "0x2222222222222222222222222222222222222222"
const ROOT_ACCOUNT = "0x1111111111111111111111111111111111111111"

describe("ClaimSDK connected account entitlement checks", () => {
  it("checks entitlement against the whitelisted root instead of the connected wallet", async () => {
    const publicClient = {
      readContract: vi.fn().mockResolvedValue(123n),
    }

    const walletClient = {
      account: { address: CONNECTED_ACCOUNT },
      chain: { id: SupportedChains.CELO },
      getAddresses: vi.fn().mockResolvedValue([CONNECTED_ACCOUNT]),
    }

    const identitySDK = {
      getWhitelistedRoot: vi.fn().mockResolvedValue({
        isWhitelisted: true,
        root: ROOT_ACCOUNT,
      }),
    }

    const sdk = new ClaimSDK({
      account: CONNECTED_ACCOUNT,
      publicClient: publicClient as unknown as PublicClient,
      walletClient: walletClient as unknown as WalletClient,
      identitySDK: identitySDK as any,
      env: "development",
    })

    const result = await sdk.checkEntitlement()

    expect(result.amount).toBe(123n)
    expect(identitySDK.getWhitelistedRoot).toHaveBeenCalledWith(
      CONNECTED_ACCOUNT,
    )
    expect(publicClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "checkEntitlement",
        args: [ROOT_ACCOUNT],
        account: CONNECTED_ACCOUNT,
      }),
    )
  })

  it("uses the same root-address entitlement path when resolving wallet claim status", async () => {
    const publicClient = {
      readContract: vi.fn().mockResolvedValue(456n),
    }

    const walletClient = {
      account: { address: CONNECTED_ACCOUNT },
      chain: { id: SupportedChains.CELO },
      getAddresses: vi.fn().mockResolvedValue([CONNECTED_ACCOUNT]),
    }

    const identitySDK = {
      getWhitelistedRoot: vi.fn().mockResolvedValue({
        isWhitelisted: true,
        root: ROOT_ACCOUNT,
      }),
    }

    const sdk = new ClaimSDK({
      account: CONNECTED_ACCOUNT,
      publicClient: publicClient as unknown as PublicClient,
      walletClient: walletClient as unknown as WalletClient,
      identitySDK: identitySDK as any,
      env: "development",
    })

    const status = await sdk.getWalletClaimStatus()

    expect(status).toEqual({
      status: "can_claim",
      entitlement: 456n,
    })
    expect(publicClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "checkEntitlement",
        args: [ROOT_ACCOUNT],
        account: CONNECTED_ACCOUNT,
      }),
    )
  })
})

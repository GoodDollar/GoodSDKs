import { describe, it, expect, vi, beforeEach } from "vitest"
import { zeroAddress } from "viem"
import { IdentitySDK } from "../src/sdks/viem-identity-sdk"

const MOCK_ROOT_ACCOUNT = "0x1111111111111111111111111111111111111111"
const MOCK_CHILD_ACCOUNT = "0x2222222222222222222222222222222222222222"

describe("IdentitySDK - Wallet Link Flows (Mocked)", () => {
  let publicClient: any
  let walletClient: any
  let sdk: IdentitySDK

  beforeEach(() => {
    publicClient = {
      readContract: vi.fn(),
      simulateContract: vi.fn().mockResolvedValue({ request: {} }),
    }

    walletClient = {
      account: { address: MOCK_ROOT_ACCOUNT },
      getAddresses: vi.fn().mockResolvedValue([MOCK_ROOT_ACCOUNT]),
      writeContract: vi.fn().mockResolvedValue("0xMockTxHash"),
    }

    sdk = new IdentitySDK({
      publicClient,
      walletClient,
      env: "development",
    })

    sdk.submitAndWait = vi.fn().mockResolvedValue({ transactionHash: "0xMockTxHash" })
  })

  describe("Read Paths: connectedAccounts & checkConnectedStatusAllChains", () => {
    it("getConnectedAccounts should return isConnected=true and root for a child account", async () => {
      publicClient.readContract.mockResolvedValueOnce(MOCK_ROOT_ACCOUNT)
      const status = await sdk.getConnectedAccounts(MOCK_CHILD_ACCOUNT)
      expect(publicClient.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "connectedAccounts",
          args: [MOCK_CHILD_ACCOUNT],
        })
      )
      expect(status.isConnected).toBe(true)
      expect(status.root).toBe(MOCK_ROOT_ACCOUNT)
    })

    it("getConnectedAccounts should return isConnected=false for unknown account", async () => {
      publicClient.readContract.mockResolvedValueOnce(zeroAddress)
      const status = await sdk.getConnectedAccounts(MOCK_CHILD_ACCOUNT)
      expect(status.isConnected).toBe(false)
      expect(status.root).toBe(zeroAddress)
    })

    it("isAccountConnected convenience boolean works", async () => {
      publicClient.readContract.mockResolvedValueOnce(MOCK_ROOT_ACCOUNT)
      const isConnected = await sdk.isAccountConnected(MOCK_CHILD_ACCOUNT)
      expect(isConnected).toBe(true)
    })

    it("checkConnectedStatusAllChains should return status entries per chain and set isConnected/root correctly", async () => {
      publicClient.readContract
        .mockResolvedValueOnce(MOCK_ROOT_ACCOUNT)
        .mockResolvedValueOnce(zeroAddress)

      const result = await sdk.checkConnectedStatusAllChains(MOCK_CHILD_ACCOUNT)

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThanOrEqual(2)

      const connectedEntry = result.find((entry) => entry.isConnected)
      const disconnectedEntry = result.find((entry) => !entry.isConnected)

      expect(connectedEntry).toEqual(
        expect.objectContaining({
          isConnected: true,
          root: MOCK_ROOT_ACCOUNT,
        }),
      )

      expect(disconnectedEntry).toEqual(
        expect.objectContaining({
          isConnected: false,
          root: zeroAddress,
        }),
      )
    })

    it("checkConnectedStatusAllChains should surface readContract rejections in the error field", async () => {
      const readError = new Error("read failed")
      publicClient.readContract
        .mockResolvedValueOnce(MOCK_ROOT_ACCOUNT)
        .mockRejectedValueOnce(readError)

      const result = await sdk.checkConnectedStatusAllChains(MOCK_CHILD_ACCOUNT)
      const erroredEntry = result.find((entry) => entry.error)

      expect(erroredEntry).toEqual(
        expect.objectContaining({
          isConnected: false,
          error: expect.stringContaining("read failed"),
        }),
      )
    })

    it("getConnectedAccounts should wrap readContract errors with a helpful message", async () => {
      const underlyingError = new Error("boom")
      publicClient.readContract.mockRejectedValueOnce(underlyingError)

      await expect(sdk.getConnectedAccounts(MOCK_CHILD_ACCOUNT)).rejects.toThrow(
        "Failed to get connected accounts: boom",
      )
    })
  })

  describe("Write Paths: connectAccount & disconnectAccount", () => {
    it("connectAccount executes custom onSecurityMessage and submits when true", async () => {
      const onSecurityMessage = vi.fn().mockResolvedValue(true)
      await sdk.connectAccount(MOCK_CHILD_ACCOUNT, { onSecurityMessage })

      expect(onSecurityMessage).toHaveBeenCalledTimes(1)
      expect(onSecurityMessage).toHaveBeenCalledWith(expect.stringMatching(/connect/i))
      
      expect(sdk.submitAndWait).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "connectAccount",
          args: [MOCK_CHILD_ACCOUNT],
        }),
        undefined
      )
    })

    it("disconnectAccount suppresses security message when skipSecurityMessage=true", async () => {
      const onSecurityMessage = vi.fn()
      await sdk.disconnectAccount(MOCK_CHILD_ACCOUNT, {
        skipSecurityMessage: true,
        onSecurityMessage,
      })

      expect(onSecurityMessage).not.toHaveBeenCalled()
      expect(sdk.submitAndWait).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "disconnectAccount",
          args: [MOCK_CHILD_ACCOUNT],
        }),
        undefined
      )
    })

    it("disconnectAccount throws and does not submit when onSecurityMessage resolves to false", async () => {
      const onSecurityMessage = vi.fn().mockResolvedValue(false)

      await expect(
        sdk.disconnectAccount(MOCK_CHILD_ACCOUNT, { onSecurityMessage })
      ).rejects.toMatchObject({
        name: expect.stringMatching(/Error/i),
      })

      expect(onSecurityMessage).toHaveBeenCalledTimes(1)
      expect(sdk.submitAndWait).not.toHaveBeenCalled()
    })
  })
})
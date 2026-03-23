import { describe, it, expect, vi, beforeEach } from "vitest"
import { zeroAddress } from "viem"
import { IdentitySDK } from "../src/sdks/viem-identity-sdk"
import { SupportedChains, WALLET_LINK_SECURITY_MESSAGES } from "../src/constants"

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

    // chain.id tells resolveChainAndContract which chain this SDK instance is on.
    // All single-chain tests use SupportedChains.CELO so this.publicClient is
    // reused automatically without needing an entry in publicClients.
    walletClient = {
      account: { address: MOCK_ROOT_ACCOUNT },
      chain: { id: SupportedChains.CELO },
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

  describe("Read Paths: checkConnectedStatus", () => {
    it("should return isConnected=true and root when account is connected (single chain)", async () => {
      publicClient.readContract.mockResolvedValueOnce(MOCK_ROOT_ACCOUNT)

      const result = await sdk.checkConnectedStatus(
        MOCK_CHILD_ACCOUNT,
        SupportedChains.CELO,
      )

      expect(publicClient.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "connectedAccounts",
          args: [MOCK_CHILD_ACCOUNT],
        }),
      )
      expect(result).toHaveLength(1)
      expect(result[0].isConnected).toBe(true)
      expect(result[0].root).toBe(MOCK_ROOT_ACCOUNT)
      expect(result[0].error).toBeUndefined()
    })

    it("should return isConnected=false when account is not connected (single chain)", async () => {
      publicClient.readContract.mockResolvedValueOnce(zeroAddress)

      const result = await sdk.checkConnectedStatus(
        MOCK_CHILD_ACCOUNT,
        SupportedChains.CELO,
      )

      expect(result[0].isConnected).toBe(false)
      expect(result[0].root).toBe(zeroAddress)
    })

    it("should query all chains and return one entry per chain when headless clients are provided", async () => {
      const publicClients = {
        [SupportedChains.CELO]: publicClient,
        [SupportedChains.FUSE]: publicClient,
        [SupportedChains.XDC]: publicClient,
      }

      publicClient.readContract
        .mockResolvedValueOnce(MOCK_ROOT_ACCOUNT) // CELO
        .mockResolvedValueOnce(zeroAddress)       // FUSE
        .mockResolvedValueOnce(zeroAddress)       // XDC

      const result = await sdk.checkConnectedStatus(
        MOCK_CHILD_ACCOUNT,
        undefined,
        publicClients,
      )

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThanOrEqual(2)

      const connectedEntry = result.find((entry) => entry.isConnected)
      const disconnectedEntry = result.find((entry) => !entry.isConnected && !entry.error)

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

    it("should surface readContract rejections in the error field", async () => {
      const publicClients = {
        [SupportedChains.CELO]: publicClient,
        [SupportedChains.FUSE]: publicClient,
        [SupportedChains.XDC]: publicClient,
      }

      const readError = new Error("read failed")
      publicClient.readContract
        .mockResolvedValueOnce(MOCK_ROOT_ACCOUNT)
        .mockRejectedValueOnce(readError)
        .mockResolvedValueOnce(zeroAddress)

      const result = await sdk.checkConnectedStatus(
        MOCK_CHILD_ACCOUNT,
        undefined,
        publicClients,
      )

      const erroredEntry = result.find((entry) => entry.error)
      expect(erroredEntry).toEqual(
        expect.objectContaining({
          isConnected: false,
          error: expect.stringContaining("read failed"),
        }),
      )
    })

    it("should return a headless error entry when checking all chains without providing publicClients", async () => {
      publicClient.readContract.mockResolvedValueOnce(MOCK_ROOT_ACCOUNT)

      const result = await sdk.checkConnectedStatus(MOCK_CHILD_ACCOUNT)

      const sdkChainEntry = result.find(r => r.chainId === SupportedChains.CELO)
      const headlessFailedEntry = result.find(r => r.chainId !== SupportedChains.CELO)

      expect(sdkChainEntry?.isConnected).toBe(true)

      expect(headlessFailedEntry?.isConnected).toBe(false)
      expect(headlessFailedEntry?.error).toContain("No public client provided")
    })
  })

  describe("Write Paths: connectAccount & disconnectAccount", () => {
    it("connectAccount executes custom onSecurityMessage and submits when true", async () => {
      const onSecurityMessage = vi.fn().mockResolvedValue(true)

      await sdk.connectAccount(MOCK_CHILD_ACCOUNT, { onSecurityMessage })

      expect(onSecurityMessage).toHaveBeenCalledTimes(1)
      expect(onSecurityMessage).toHaveBeenCalledWith(WALLET_LINK_SECURITY_MESSAGES.connect)

      expect(sdk.submitAndWait).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "connectAccount",
          args: [MOCK_CHILD_ACCOUNT],
        }),
        undefined,
      )
    })

    it("connectAccount suppresses security message when skipSecurityMessage=true", async () => {
      const onSecurityMessage = vi.fn()

      await sdk.connectAccount(MOCK_CHILD_ACCOUNT, {
        skipSecurityMessage: true,
        onSecurityMessage,
      })

      expect(onSecurityMessage).not.toHaveBeenCalled()
      expect(sdk.submitAndWait).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "connectAccount",
          args: [MOCK_CHILD_ACCOUNT],
        }),
        undefined,
      )
    })

    it("connectAccount throws and does not submit when onSecurityMessage resolves to false", async () => {
      const onSecurityMessage = vi.fn().mockResolvedValue(false)

      await expect(
        sdk.connectAccount(MOCK_CHILD_ACCOUNT, { onSecurityMessage }),
      ).rejects.toThrow(/cancelled/i)

      expect(onSecurityMessage).toHaveBeenCalledTimes(1)
      expect(sdk.submitAndWait).not.toHaveBeenCalled()
    })

    it("disconnectAccount calls onSecurityMessage and proceeds when it resolves to true", async () => {
      const onSecurityMessage = vi.fn().mockResolvedValue(true)

      await sdk.disconnectAccount(MOCK_CHILD_ACCOUNT, { onSecurityMessage })

      expect(onSecurityMessage).toHaveBeenCalledTimes(1)
      expect(onSecurityMessage).toHaveBeenCalledWith(WALLET_LINK_SECURITY_MESSAGES.disconnect)

      expect(sdk.submitAndWait).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "disconnectAccount",
          args: [MOCK_CHILD_ACCOUNT],
        }),
        undefined,
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
        undefined,
      )
    })

    it("disconnectAccount throws and does not submit when onSecurityMessage resolves to false", async () => {
      const onSecurityMessage = vi.fn().mockResolvedValue(false)

      await expect(
        sdk.disconnectAccount(MOCK_CHILD_ACCOUNT, { onSecurityMessage }),
      ).rejects.toThrow(/cancelled/i)

      expect(onSecurityMessage).toHaveBeenCalledTimes(1)
      expect(sdk.submitAndWait).not.toHaveBeenCalled()
    })

    it("connectAccount passes onHash callback through to submitAndWait", async () => {
      const onSecurityMessage = vi.fn().mockResolvedValue(true)
      const onHash = vi.fn()

        ; (sdk.submitAndWait as ReturnType<typeof vi.fn>).mockImplementationOnce(
          async (_params: any, hashCb?: (h: `0x${string}`) => void) => {
            hashCb?.("0xdeadbeef" as `0x${string}`)
          },
        )

      await sdk.connectAccount(MOCK_CHILD_ACCOUNT, { onSecurityMessage, onHash })

      expect(onHash).toHaveBeenCalledWith("0xdeadbeef")
    })
  })
})
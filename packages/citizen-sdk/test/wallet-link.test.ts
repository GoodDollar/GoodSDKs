import { describe, it, expect, vi, beforeEach } from "vitest"
import { zeroAddress } from "viem"
import { IdentitySDK } from "../src/sdks/viem-identity-sdk"
import { WALLET_LINK_SECURITY_MESSAGES } from "../src/constants"


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
      signMessage: vi.fn().mockResolvedValue("0xMockSignature"),
    }

    // Init SDK
    sdk = new IdentitySDK({
      publicClient,
      walletClient,
      env: "development",
    })

    // Bypass actual blockchain waiting in tests
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
  })


  describe("Write Paths: connectAccount & disconnectAccount", () => {
    it("connectAccount triggers security message and submits transaction", async () => {
      await sdk.connectAccount(MOCK_CHILD_ACCOUNT)

      
      expect(walletClient.signMessage).toHaveBeenCalledWith({
        account: MOCK_ROOT_ACCOUNT,
        message: WALLET_LINK_SECURITY_MESSAGES.connect,
      })

      
      expect(sdk.submitAndWait).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "connectAccount",
          args: [MOCK_CHILD_ACCOUNT],
        }),
        undefined
      )
    })

    it("disconnectAccount suppresses security message when skipSecurityMessage=true", async () => {
      
      await sdk.disconnectAccount(MOCK_CHILD_ACCOUNT, { skipSecurityMessage: true })

      expect(walletClient.signMessage).not.toHaveBeenCalled()
    
      expect(sdk.submitAndWait).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "disconnectAccount",
          args: [MOCK_CHILD_ACCOUNT],
        }),
        undefined
      )
    })
  })
})
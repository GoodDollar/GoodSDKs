
import {
  type Account,
  Address,
  type Chain,
  PublicClient,
  WalletClient,
  SimulateContractParameters,
  WalletActions,
  LocalAccount,
  zeroAddress,
} from "viem"

import { waitForTransactionReceipt } from "viem/actions"
import { compressToEncodedURIComponent } from "lz-string"

import {
  contractEnv,
  Envs,
  FV_IDENTIFIER_MSG2,
  identityV2ABI,
} from "../constants"

import { resolveChainAndContract } from "../utils/chains"

import type {
  IdentityContract,
  IdentityExpiryData,
  IdentityExpiry,
} from "../types"

/**
 * Initializes the Identity Contract.
 * @param publicClient - The PublicClient instance.
 * @param contractAddress - The contract address.
 * @returns An IdentityContract instance.
 */
export const initializeIdentityContract = (
  publicClient: PublicClient,
  contractAddress: Address,
): IdentityContract => ({
  publicClient,
  contractAddress,
})

export interface IdentitySDKOptions {
  account?: Address
  publicClient: PublicClient
  walletClient: WalletClient<any, Chain | undefined, Account | undefined>
  env: contractEnv
}

/**
 * Handles interactions with the Identity Contract.
 */
export class IdentitySDK {
  public account: Address
  publicClient: PublicClient
  walletClient: WalletClient & WalletActions
  public contract: IdentityContract
  public env: contractEnv = "production"

  /**
   * Initializes the IdentitySDK.
   * @param publicClient - The PublicClient instance.
   * @param walletClient - The WalletClient with WalletActions.
   * @param env - The environment to use ("production" | "staging" | "development").
   */
  constructor({
    account,
    publicClient,
    walletClient,
    env,
  }: IdentitySDKOptions) {
    if (!walletClient.account) {
      throw new Error("ClaimSDK: WalletClient must have an account attached.")
    }
    this.publicClient = publicClient
    this.walletClient = walletClient
    this.env = env
    this.account = account ?? walletClient.account.address

    const { contractEnvAddresses } = resolveChainAndContract(walletClient, env)

    this.contract = initializeIdentityContract(
      this.publicClient,
      contractEnvAddresses.identityContract,
    )
  }

  static async init(
    props: Omit<IdentitySDKOptions, "account">,
  ): Promise<IdentitySDK> {
    const [account] = await props.walletClient.getAddresses()
    return new IdentitySDK({ account, ...props })
  }

  /**
   * Submits a transaction and waits for its receipt.
   * @param params - Parameters for simulating the contract call.
   * @param onHash - Optional callback to receive the transaction hash.
   * @returns The transaction receipt.
   * @throws If submission fails or no active wallet address is found.
   */
  async submitAndWait(
    params: SimulateContractParameters,
    onHash?: (hash: `0x${string}`) => void,
  ): Promise<any> {
    try {
      if (!this.account) throw new Error("No active wallet address found.")

      const { request } = await this.publicClient.simulateContract({
        account: this.account,
        ...params,
      })

      const hash = await this.walletClient.writeContract(request)
      onHash?.(hash)

      return waitForTransactionReceipt(this.publicClient, { hash })
    } catch (error: any) {
      console.error("submitAndWait Error:", error)
      throw new Error(`Failed to submit transaction: ${error.message}`)
    }
  }

  /**
   * Returns whitelist status of main account or any connected account.
   * @param account - The account address to check.
   * @returns An object containing whitelist status and root address.
   * @reference: https://docs.gooddollar.org/user-guides/connect-another-wallet-address-to-identity
   */
  async getWhitelistedRoot(
    account: Address,
  ): Promise<{ isWhitelisted: boolean; root: Address }> {
    try {
      const root = await this.publicClient.readContract({
        address: this.contract.contractAddress,
        abi: identityV2ABI,
        functionName: "getWhitelistedRoot",
        args: [account],
      })

      return {
        isWhitelisted: root !== zeroAddress,
        root,
      }
    } catch (error: any) {
      console.error("getWhitelistedRoot Error:", error)
      throw new Error(`Failed to get whitelisted root: ${error.message}`)
    }
  }

  /**
   * Retrieves identity expiry data for a given account.
   * @param account - The account address.
   * @returns The identity expiry data.
   */
  async getIdentityExpiryData(account: Address): Promise<IdentityExpiryData> {
    try {
      const [lastAuthenticated, authPeriod] = await Promise.all([
        this.publicClient.readContract({
          address: this.contract.contractAddress,
          abi: identityV2ABI,
          functionName: "lastAuthenticated",
          args: [account],
        }),
        this.publicClient.readContract({
          address: this.contract.contractAddress,
          abi: identityV2ABI,
          functionName: "authenticationPeriod",
          args: [],
        }),
      ])

      return { lastAuthenticated, authPeriod }
    } catch (error: any) {
      console.error("getIdentityExpiryData Error:", error)
      throw new Error(
        `Failed to retrieve identity expiry data: ${error.message}`,
      )
    }
  }

  /**
   * Generates a Face Verification Link.
   * @param popupMode - Whether to generate a popup link.
   * @param callbackUrl - The URL to callback after verification.
   * @param chainId - The blockchain network ID.
   * @returns The generated Face Verification link.
   */
  async generateFVLink(
    popupMode: boolean = false,
    callbackUrl?: string,
    chainId?: number,
  ): Promise<string> {
    try {
      const address = this.account
      if (!address) throw new Error("No wallet address found.")

      const nonce = Math.floor(Date.now() / 1000).toString()

      const fvSigMessage = FV_IDENTIFIER_MSG2.replace("<account>", address)
      const fvSig = await this.walletClient.signMessage({
        account: address,
        message: fvSigMessage,
      })

      const { identityUrl } = Envs[this.env]
      if (!identityUrl) {
        throw new Error("identityUrl is not defined in environment settings.")
      }

      if (!fvSig) {
        throw new Error("Missing signature for Face Verification.")
      }

      if (!popupMode && !callbackUrl) {
        throw new Error("Callback URL is required for redirect mode.")
      }

      const url = new URL(identityUrl)
      const params: Record<string, string | number> = {
        account: address,
        nonce,
        fvsig: fvSig,
        chain: chainId || (await this.publicClient.getChainId()),
      }

      if (callbackUrl) {
        params[popupMode ? "cbu" : "rdu"] = callbackUrl
      }

      url.searchParams.append(
        "lz",
        compressToEncodedURIComponent(JSON.stringify(params)),
      )
      return url.toString()
    } catch (error: any) {
      console.error("generateFVLink Error:", error)
      throw new Error(
        `Failed to generate Face Verification link: ${error.message}`,
      )
    }
  }

  /**
   * Calculates the identity expiry timestamp.
   * @param lastAuthenticated - The timestamp of last authentication.
   * @param authPeriod - The authentication period.
   * @returns The identity expiry data.
   */
  calculateIdentityExpiry(
    lastAuthenticated: bigint,
    authPeriod: bigint,
  ): IdentityExpiry {
    const MS_IN_A_SECOND = 1000
    const MS_IN_A_DAY = 24 * 60 * 60 * MS_IN_A_SECOND

    const periodInMs = authPeriod * BigInt(MS_IN_A_DAY)
    const expiryTimestamp =
      lastAuthenticated * BigInt(MS_IN_A_SECOND) + periodInMs

    return {
      expiryTimestamp,
    }
  }

  /**
   * Navigates to face verification.
   * @param popupMode - Whether to use popup mode.
   * @param callbackUrl - The URL to callback after verification.
   * @param chainId - The blockchain network ID.
   */
  async navigateToFaceVerification(
    popupMode: boolean = false,
    callbackUrl?: string,
    chainId?: number,
  ): Promise<void> {
    const fvLink = await this.generateFVLink(popupMode, callbackUrl, chainId)
    
    if (typeof window !== "undefined") {
      if (popupMode) {
        window.open(fvLink, "_blank")
      } else {
        window.location.href = fvLink
      }
    } else {
      throw new Error(
        "Face verification navigation is only supported in browser environments.",
      )
    }
  }
}

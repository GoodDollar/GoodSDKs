
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
  chainConfigs,
  Envs,
  FV_IDENTIFIER_MSG2,
  identityV2ABI,
  FarcasterAppConfigs,
  SupportedChains,
  isSupportedChain,
} from "../constants"

import { resolveChainAndContract } from "../utils/chains"
import {
  navigateToUrl,
  createVerificationCallbackUrl,
  createFarcasterUniversalLink,
  isInFarcasterMiniApp
} from "../utils/auth"

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
  farcasterConfig?: { appId: string; appSlug: string }
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
  private readonly chainId: SupportedChains
  private readonly fvDefaultChain: SupportedChains
  private readonly farcasterConfig?: { appId: string; appSlug: string }

  /**
   * Initializes the IdentitySDK.
   * @param publicClient - The PublicClient instance.
   * @param walletClient - The WalletClient with WalletActions.
   * @param env - The environment to use ("production" | "staging" | "development").
   * @param farcasterConfig - Optional Farcaster App config (appId, appSlug).
   */
  constructor({
    account,
    publicClient,
    walletClient,
    env,
    farcasterConfig,
  }: IdentitySDKOptions) {
    if (!walletClient.account) {
      throw new Error(
        "IdentitySDK: WalletClient must have an account attached.",
      )
    }
    this.publicClient = publicClient
    this.walletClient = walletClient
    this.env = env
    this.account = account ?? walletClient.account.address
    this.farcasterConfig = farcasterConfig

    const { chainId, contractEnvAddresses } = resolveChainAndContract(
      walletClient,
      env,
    )

    this.chainId = chainId
    this.fvDefaultChain = chainConfigs[chainId]?.fvDefaultChain ?? chainId

    this.contract = initializeIdentityContract(
      this.publicClient,
      contractEnvAddresses.identityContract,
    )
  }

  /**
   * Initializes the IdentitySDK with an account from the wallet client.
   * @param props - SDK options without account (account is auto-detected)
   * @returns A new IdentitySDK instance
   */
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

      return await waitForTransactionReceipt(this.publicClient, { hash })
    } catch (error: any) {
      console.error("submitAndWait Error:", error)
      throw error
    }
  }

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
      throw new Error(`Failed to check whitelist status: ${error.message}`)
    }
  }

  async getIdentityExpiryData(account: Address): Promise<IdentityExpiryData> {
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
  }

  async generateFVLink(
    popupMode: boolean = false,
    callbackUrl?: string,
    chainId?: number,
  ): Promise<string> {
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
    const fallbackChain = this.fvDefaultChain ?? this.chainId
    const resolvedChain =
      typeof chainId === "number" ? chainId : fallbackChain
    const fvChain = isSupportedChain(resolvedChain)
      ? resolvedChain
      : fallbackChain

    const params: Record<string, string | number> = {
      account: address,
      nonce,
      fvsig: fvSig,
      chain: fvChain,
    }

    if (callbackUrl) {
      // Add callback URL with verification parameters
      const isInFarcaster = await isInFarcasterMiniApp();
      const farcasterAppConfig = this.farcasterConfig ?? FarcasterAppConfigs[this.env];

      if (isInFarcaster && farcasterAppConfig) {
        const farcasterConfig = farcasterAppConfig;
        const universalLinkCallback = createFarcasterUniversalLink(
          farcasterConfig,
          'verify',
          {
            source: "gooddollar_identity_verification",
            account: address,
            nonce: nonce
          }
        );
        params[popupMode ? "cbu" : "rdu"] = universalLinkCallback;
      } else {
        const callbackUrlWithParams = await createVerificationCallbackUrl(callbackUrl);
        params[popupMode ? "cbu" : "rdu"] = callbackUrlWithParams;
      }
    }

    url.searchParams.append(
      "lz",
      compressToEncodedURIComponent(JSON.stringify(params)),
    )
    return url.toString()
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

}

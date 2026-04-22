import {
  type Account,
  Address,
  type Chain,
  PublicClient,
  WalletClient,
  SimulateContractParameters,
  WalletActions,
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
  SupportedChains,
  isSupportedChain,
  WALLET_LINK_SECURITY_MESSAGES,
} from "../constants"

import { resolveChainAndContract } from "../utils/chains"
import {
  createRpcIteratorRegistry,
  getRpcFallbackClient,
} from "../utils/rpcFallback"

import type {
  IdentityContract,
  IdentityExpiryData,
  IdentityExpiry,
  WalletLinkOptions,
  WalletLinkAction,
  ChainConnectedStatus,
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
  private readonly chainId: SupportedChains
  private readonly fvDefaultChain: SupportedChains
  private readonly rpcIterators = createRpcIteratorRegistry()

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
      throw new Error(
        "IdentitySDK: WalletClient must have an account attached.",
      )
    }
    this.publicClient = publicClient
    this.walletClient = walletClient
    this.env = env
    this.account = account ?? walletClient.account.address

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

  static async init(
    props: Omit<IdentitySDKOptions, "account">,
  ): Promise<IdentitySDK> {
    const [account] = await props.walletClient.getAddresses()
    return new IdentitySDK({ account, ...props })
  }

  /**
   * Evaluates security constraints and prompts the user with security messages if required.
   * Custodial/automated flows can bypass this entirely via `skipSecurityMessage: true`.
   * For native wallet flows, `onSecurityMessage` receives the notice and must resolve
   * to `true` for the transaction to proceed. Without either option the message is
   * logged to `console.info` as a headless default.
   * @param action - The wallet link action being performed ("connect" or "disconnect").
   * @param options - Additional wallet link options including security prompt handlers.
   */
  private async runSecurityCheck(
    action: keyof typeof WALLET_LINK_SECURITY_MESSAGES,
    options?: WalletLinkOptions,
  ): Promise<void> {
    if (options?.skipSecurityMessage) return

    const message = WALLET_LINK_SECURITY_MESSAGES[action]

    if (options?.onSecurityMessage) {
      const confirmed = await options.onSecurityMessage(message)
      if (!confirmed) {
        throw new Error(
          `Wallet ${action} cancelled: user did not confirm security notice.`,
        )
      }
      return
    }

    console.info(`[IdentitySDK] ${message}`)
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
      const message = error instanceof Error ? error.message : String(error)
      console.error("submitAndWait Error:", error)
      throw new Error(`Failed to submit transaction: ${message}`)
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
      const message = error instanceof Error ? error.message : String(error)
      console.error("getWhitelistedRoot Error:", error)
      throw new Error(`Failed to get whitelisted root: ${message}`)
    }
  }

  /**
   * Checks the wallet-link connection status of the given account.
   *
   * When `chainId` is provided the query is scoped to that single chain only.
   * When omitted, all supported chains are queried in parallel via Promise.allSettled
   * and one ChainConnectedStatus entry is returned per chain.
   *
   * App-provided public clients always take precedence. For the SDK's current
   * chain `this.publicClient` is reused when no override is passed. For other
   * chains the SDK falls back to local read-only RPC clients using the same
   * fallback flow as other multi-chain reads.
   *
   * @param account - The account address to check.
   * @param chainId - Optional. Restricts the query to this chain only.
   * @param publicClients - Optional. App-level public clients keyed by SupportedChains ID.
   * @returns An array of ChainConnectedStatus (one entry per queried chain).
   */
  async checkConnectedStatus(
    account: Address,
    chainId?: SupportedChains,
    publicClients?: Record<SupportedChains, PublicClient>,
  ): Promise<ChainConnectedStatus[]> {
    const configs = chainId
      ? Object.values(chainConfigs).filter((config) => config.id === chainId)
      : Object.values(chainConfigs)

    const settled = await Promise.allSettled(
      configs.map(async (config) => {
        const contracts = config.contracts[this.env]

        if (!contracts) {
          return {
            chainId: config.id,
            chainName: config.label,
            isConnected: false,
            root: zeroAddress as Address,
            error: `No contract configured for env "${this.env}" on ${config.label}`,
          } satisfies ChainConnectedStatus
        }

        const isPrimaryChain = this.chainId === config.id
        const client =
          publicClients?.[config.id] ??
          (isPrimaryChain
            ? this.publicClient
            : getRpcFallbackClient(config.id, this.rpcIterators))

        const root = (await client.readContract({
          address: contracts.identityContract,
          abi: identityV2ABI,
          functionName: "connectedAccounts",
          args: [account],
        })) as Address

        return {
          chainId: config.id,
          chainName: config.label,
          isConnected: root !== zeroAddress,
          root,
        } satisfies ChainConnectedStatus
      }),
    )

    return settled.map((result, i) => {
      const config = configs[i]
      if (result.status === "fulfilled") return result.value
      return {
        chainId: config.id,
        chainName: config.label,
        isConnected: false,
        root: zeroAddress as Address,
        error: (result.reason as Error)?.message ?? "Unknown RPC error",
      }
    })
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
      const message = error instanceof Error ? error.message : String(error)
      console.error("getIdentityExpiryData Error:", error)
      throw new Error(
        `Failed to retrieve identity expiry data: ${message}`,
      )
    }
  }

  /**
   * Updates the wallet-link status of an account.
   * The whitelisted root identity must be the signer for `connectAccount`,
   * while `disconnectAccount` can be called by either the root identity or
   * the connected account itself.
   * Custodial flows can pass `skipSecurityMessage: true` to bypass the notice;
   * the underlying transaction signing is handled by the app-provided walletClient
   * (or IdentityCustodialSDK for LocalAccount signers).
   * @param action - The wallet-link action to submit.
   * @param account - The account address to update.
   * @param options - Additional options, such as security prompts.
   * @returns The transaction receipt.
   */
  async updateConnectionStatus(
    action: WalletLinkAction,
    account: Address,
    options?: WalletLinkOptions,
  ): Promise<any> {
    const securityAction =
      action === "connectAccount" ? "connect" : "disconnect"
    const actionLabel =
      action === "connectAccount" ? "connect" : "disconnect"

    try {
      await this.runSecurityCheck(securityAction, options)

      return this.submitAndWait(
        {
          address: this.contract.contractAddress,
          abi: identityV2ABI,
          functionName: action,
          args: [account],
        },
        options?.onHash,
      )
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error)
      console.error("updateConnectionStatus Error:", error)
      throw new Error(`Failed to ${actionLabel} account: ${message}`)
    }
  }

  /**
   * Connects a new account to the identity.
   * The whitelisted root identity must be the signer. No additional message
   * signature is required beyond the transaction itself.
   * @param account - The account address to connect.
   * @param options - Additional options, such as security prompts.
   * @returns The transaction receipt.
   */
  async connectAccount(
    account: Address,
    options?: WalletLinkOptions,
  ): Promise<any> {
    return this.updateConnectionStatus("connectAccount", account, options)
  }

  /**
   * Disconnects an account from the identity.
   * Either the root identity or the connected account itself can call this.
   * @param account - The account address to disconnect.
   * @param options - Additional options, such as security prompts.
   * @returns The transaction receipt.
   */
  async disconnectAccount(
    account: Address,
    options?: WalletLinkOptions,
  ): Promise<any> {
    return this.updateConnectionStatus("disconnectAccount", account, options)
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
    chainId?: SupportedChains,
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
        params[popupMode ? "cbu" : "rdu"] = callbackUrl
      }

      url.searchParams.append(
        "lz",
        compressToEncodedURIComponent(JSON.stringify(params)),
      )
      return url.toString()
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error)
      console.error("generateFVLink Error:", error)
      throw new Error(
        `Failed to generate Face Verification link: ${message}`,
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

    return { expiryTimestamp }
  }
}

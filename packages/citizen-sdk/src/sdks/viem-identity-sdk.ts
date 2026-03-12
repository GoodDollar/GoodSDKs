import {
  type Account,
  Address,
  type Chain,
  PublicClient,
  WalletClient,
  SimulateContractParameters,
  WalletActions,
  zeroAddress,
  createPublicClient,
  http,
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

import type {
  IdentityContract,
  IdentityExpiryData,
  IdentityExpiry,
  WalletLinkOptions,
  ConnectedAccountStatus,
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
 *
 * @example
 * ```ts
 * const sdk = await IdentitySDK.init({ publicClient, walletClient, env: "production" })
 *
 * // Connect a secondary wallet (root calls this)
 * await sdk.connectAccount("0xSecondary...")
 *
 * // Check connection status on current chain
 * const { isConnected, root } = await sdk.getConnectedAccounts("0xSecondary...")
 *
 * // Check across all chains at once
 * const statuses = await sdk.checkConnectedStatusAllChains("0xSecondary...")
 *
 * // Disconnect
 * await sdk.disconnectAccount("0xSecondary...")
 * ```
 */
export class IdentitySDK {
  public account: Address
  publicClient: PublicClient
  walletClient: WalletClient & WalletActions
  public contract: IdentityContract
  public env: contractEnv = "production"
  private readonly chainId: SupportedChains
  private readonly fvDefaultChain: SupportedChains

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
   * Runs the security pre-flight check before any wallet-link write action.
   * Skipped when `options.skipSecurityMessage` is `true`.
   *
   * @param action - "connect" or "disconnect"
   * @param options - WalletLinkOptions passed by the caller
   * @throws If the caller-provided `onSecurityMessage` callback resolves to `false`.
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
      console.error("submitAndWait Error:", error)
      throw new Error(`Failed to submit transaction: ${error.message}`)
    }
  }

  /**
   * Returns whitelist status of main account or any connected account.
   *
   * - If `root === account` the account is a primary whitelisted identity.
   * - If `root !== account && root !== zeroAddress` it is a connected (child) wallet.
   * - If `root === zeroAddress` the account has no GoodDollar identity.
   *
   * @param account - The account address to check.
   * @returns An object containing whitelist status and root address.
   * @reference https://docs.gooddollar.org/user-guides/connect-another-wallet-address-to-identity
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
   * Checks whether `account` is registered as a secondary (connected) wallet
   * on the current chain and returns its root identity address.
   *
   * Uses `connectedAccounts(address)` which only returns a non-zero address when
   * the queried account is a _child_ — not when it is the primary root itself.
   * Use {@link getWhitelistedRoot} to distinguish primary vs child status.
   *
   * @param account - The wallet address to check.
   * @returns `{ isConnected, root }` where `root` is `zeroAddress` when not connected.
   */
  async getConnectedAccounts(account: Address): Promise<ConnectedAccountStatus> {
    try {
      const root = await this.publicClient.readContract({
        address: this.contract.contractAddress,
        abi: identityV2ABI,
        functionName: "connectedAccounts",
        args: [account],
      }) as Address

      return {
        isConnected: root !== zeroAddress,
        root,
      }
    } catch (error: any) {
      console.error("getConnectedAccounts Error:", error)
      throw new Error(`Failed to get connected accounts: ${error.message}`)
    }
  }

  /**
   * Convenience boolean check — returns `true` if `account` is a connected
   * (child) wallet on the current chain.
   */
  async isAccountConnected(account: Address): Promise<boolean> {
    const { isConnected } = await this.getConnectedAccounts(account)
    return isConnected
  }

  /**
   * Checks connection status for `account` across **all** supported chains
   * simultaneously. Each chain uses its own read-only public client so no
   * network switch is required.
   *
   * @param account - The wallet address to check.
   * @returns An array of per-chain statuses (one entry per supported chain).
   */
  async checkConnectedStatusAllChains(
    account: Address,
  ): Promise<ChainConnectedStatus[]> {
    const entries = Object.values(chainConfigs)

    const settled = await Promise.allSettled(
      entries.map(async (config) => {
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

        const client = createPublicClient({
          transport: http(config.rpcUrls[0]),
        })

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
      const config = entries[i]
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
      console.error("getIdentityExpiryData Error:", error)
      throw new Error(
        `Failed to retrieve identity expiry data: ${error.message}`,
      )
    }
  }

  /**
   * Links a secondary wallet address to the caller's whitelisted root identity.
   *
   * **Only a whitelisted root identity may call this.** The secondary wallet
   * (`account`) does not need to sign anything — this is a single-sig transaction
   * sent by the root, making it suitable for native/custodial wallet flows.
   *
   * A security notice is shown to the end-user by default. Integrators that
   * handle consent in their own UI can suppress it with `skipSecurityMessage: true`.
   *
   * @param account - The secondary wallet address to connect.
   * @param options - Optional wallet-link options (security message, hash callback).
   * @returns The transaction receipt once mined.
   *
   * @example
   * ```ts
   * // Default — logs security notice to console
   * await sdk.connectAccount("0xSecondary...")
   *
   * // With UI confirmation dialog wired up
   * await sdk.connectAccount("0xSecondary...", {
   * onSecurityMessage: async (msg) => window.confirm(msg),
   * })
   *
   * // Custodial flow — suppress notice entirely
   * await sdk.connectAccount("0xSecondary...", { skipSecurityMessage: true })
   * ```
   */
  async connectAccount(
    account: Address,
    options?: WalletLinkOptions,
  ): Promise<any> {
    try {
      await this.runSecurityCheck("connect", options)

      return this.submitAndWait(
        {
          address: this.contract.contractAddress,
          abi: identityV2ABI,
          functionName: "connectAccount",
          args: [account],
        },
        options?.onHash,
      )
    } catch (error: any) {
      console.error("connectAccount Error:", error)
      throw new Error(`Failed to connect account: ${error.message}`)
    }
  }

  /**
   * Removes a secondary wallet address from the caller's whitelisted identity.
   *
   * **Either the root identity or the connected account itself may call this.**
   * Like `connectAccount`, only a single signature from the caller is required.
   *
   * @param account - The secondary wallet address to disconnect.
   * @param options - Optional wallet-link options (security message, hash callback).
   * @returns The transaction receipt once mined.
   *
   * @example
   * ```ts
   * await sdk.disconnectAccount("0xSecondary...")
   * ```
   */
  async disconnectAccount(
    account: Address,
    options?: WalletLinkOptions,
  ): Promise<any> {
    try {
      await this.runSecurityCheck("disconnect", options)

      return this.submitAndWait(
        {
          address: this.contract.contractAddress,
          abi: identityV2ABI,
          functionName: "disconnectAccount",
          args: [account],
        },
        options?.onHash,
      )
    } catch (error: any) {
      console.error("disconnectAccount Error:", error)
      throw new Error(`Failed to disconnect account: ${error.message}`)
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

    return { expiryTimestamp }
  }
}
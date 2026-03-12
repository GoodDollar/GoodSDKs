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

export class IdentitySDK {
  public account: Address
  publicClient: PublicClient
  walletClient: WalletClient & WalletActions
  public contract: IdentityContract
  public env: contractEnv = "production"
  private readonly chainId: SupportedChains
  private readonly fvDefaultChain: SupportedChains
  
  // Cache for cross-chain public clients
  private publicClientCache: Map<string, PublicClient> = new Map()

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

  private getOrCreatePublicClient(config: any): PublicClient {
    const key = `${config.id}:${this.env}`
    const cached = this.publicClientCache.get(key)
    if (cached) return cached

    const publicClient = createPublicClient({
      transport: http(config.rpcUrls[0]),
    })

    this.publicClientCache.set(key, publicClient)
    return publicClient
  }

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
      const message = error instanceof Error ? error.message : String(error)
      console.error("getConnectedAccounts Error:", error)
      throw new Error(`Failed to get connected accounts: ${message}`)
    }
  }

  async isAccountConnected(account: Address): Promise<boolean> {
    const { isConnected } = await this.getConnectedAccounts(account)
    return isConnected
  }

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

        const client = this.getOrCreatePublicClient(config)

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
      const message = error instanceof Error ? error.message : String(error)
      console.error("connectAccount Error:", error)
      throw new Error(`Failed to connect account: ${message}`)
    }
  }

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
      const message = error instanceof Error ? error.message : String(error)
      console.error("disconnectAccount Error:", error)
      throw new Error(`Failed to disconnect account: ${message}`)
    }
  }

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
      const message = error instanceof Error ? error.message : String(error)
      console.error("generateFVLink Error:", error)
      throw new Error(
        `Failed to generate Face Verification link: ${message}`,
      )
    }
  }

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
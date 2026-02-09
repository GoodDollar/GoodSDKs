import {
  zeroAddress,
  type Account,
  type Address,
  type Chain,
  type PublicClient,
  type SimulateContractParameters,
  type WalletClient,
  ContractFunctionExecutionError,
  TransactionReceipt,
} from "viem"

import { waitForTransactionReceipt } from "viem/actions"

import { IdentitySDK } from "./viem-identity-sdk"
import {
  contractEnv,
  chainConfigs,
  FALLBACK_CHAIN_PRIORITY,
  SupportedChains,
  faucetABI,
  isSupportedChain,
  ubiSchemeV2ABI,
} from "../constants"
import type { ContractAddresses } from "../constants"
import { resolveChainAndContract } from "../utils/chains"
import { triggerFaucet as triggerFaucetUtil } from "../utils/triggerFaucet"
import {
  createRpcIteratorRegistry,
  extractErrorMessage,
  getRpcFallbackClient,
  shouldRetryRpcFallback,
} from "../utils/rpcFallback"

export interface ClaimSDKOptions {
  account: Address
  publicClient: PublicClient
  walletClient: WalletClient<any, Chain | undefined, Account | undefined>
  identitySDK: IdentitySDK
  rdu?: string
  env?: contractEnv
}

const DAY = 1000 * 60 * 60 * 24

export interface WalletClaimStatus {
  status: "not_whitelisted" | "can_claim" | "already_claimed"
  entitlement: bigint
  nextClaimTime?: Date
}

export interface CheckEntitlementOptions {
  publicClient?: PublicClient
  chainOverride?: SupportedChains
}

export interface ClaimEntitlementResult {
  amount: bigint
  altClaimAvailable: boolean
  altChainId: SupportedChains | null
  altAmount: bigint | null
}

type AltClaimCandidate = {
  chainId: SupportedChains
  amount: bigint
}

export class ClaimSDK {
  readonly publicClient: PublicClient
  readonly walletClient: WalletClient<
    any,
    Chain | undefined,
    Account | undefined
  >
  private readonly identitySDK: IdentitySDK
  private readonly chainId: SupportedChains
  private readonly chainContracts: Map<SupportedChains, ContractAddresses>
  private readonly fallbackChains: SupportedChains[]
  private readonly rpcIterators = createRpcIteratorRegistry()
  private readonly fvDefaultChain: SupportedChains
  private readonly ubiSchemeAddress: Address
  private readonly faucetAddress: Address
  private readonly account: Address
  private readonly env: contractEnv
  public readonly rdu: string
  private whitelistedRootCache: Address | null = null

  constructor({
    account,
    publicClient,
    walletClient,
    identitySDK,
    rdu = typeof window !== "undefined" ? window.location.href : "",
    env = "production",
  }: ClaimSDKOptions) {
    if (!walletClient.account) {
      throw new Error("ClaimSDK: WalletClient must have an account attached.")
    }
    this.publicClient = publicClient
    this.walletClient = walletClient
    this.identitySDK = identitySDK
    this.account = account ?? walletClient.account.address

    this.rdu = rdu
    this.env = env

    const { chainId, contractEnvAddresses } = resolveChainAndContract(
      walletClient,
      env,
    )

    this.chainId = chainId
    this.chainContracts = new Map([[chainId, contractEnvAddresses]])

    const config = chainConfigs[chainId]
    this.fvDefaultChain = config.fvDefaultChain ?? chainId

    const fallbackEntries = FALLBACK_CHAIN_PRIORITY.filter(
      (fallbackChain) => fallbackChain !== chainId,
    )
      .map((fallbackChain) => {
        const fallbackContracts =
          chainConfigs[fallbackChain]?.contracts[env] ?? null

        if (!fallbackContracts) {
          return null
        }

        return [fallbackChain, fallbackContracts] as const
      })
      .filter(
        (entry): entry is readonly [SupportedChains, ContractAddresses] =>
          entry !== null,
      )

    this.fallbackChains = fallbackEntries?.map(([id]) => id)

    fallbackEntries?.forEach(([id, contracts]) => {
      this.chainContracts.set(id, contracts)
    })

    this.ubiSchemeAddress = contractEnvAddresses.ubiContract as Address
    this.faucetAddress = contractEnvAddresses.faucetContract as Address
  }

  private getContractsForChain(chainId: SupportedChains): ContractAddresses {
    const contracts = this.chainContracts.get(chainId)

    if (!contracts) {
      throw new Error(
        `Missing contract configuration for chain ${chainId} in env ${this.env}.`,
      )
    }

    return contracts
  }

  private getActiveChainId(): SupportedChains {
    const connectedChainId = this.walletClient.chain?.id

    if (isSupportedChain(connectedChainId)) {
      return connectedChainId
    }

    return this.chainId
  }

  /**
   * Resolves the whitelisted root address for the connected account.
   * This enables connected accounts to claim on behalf of their main whitelisted account.
   *
   * Failure modes are normalized so callers see predictable behavior:
   * - Throws when no whitelisted root exists for the connected account.
   * - Throws when the SDK cannot resolve a whitelisted root (network / domain errors).
   *
   * @returns The whitelisted root address to use for entitlement checks.
   * @throws Error if no whitelisted root exists or resolution fails for any reason.
   */
  private async getWhitelistedRootAddress(): Promise<Address> {
    // Return cached value if available
    if (this.whitelistedRootCache) {
      return this.whitelistedRootCache
    }

    try {
      // Resolve the whitelisted root for this account
      const { root, isWhitelisted } = await this.identitySDK.getWhitelistedRoot(
        this.account,
      )

      // Normalize "no root" / "not whitelisted" cases
      if (!isWhitelisted || !root || root === zeroAddress) {
        throw new Error(
          "No whitelisted root address found for connected account; the user may not be whitelisted.",
        )
      }

      // Cache the result
      this.whitelistedRootCache = root

      return root
    } catch (error) {
      // Normalize SDK and transport errors into a predictable failure mode
      const message =
        error instanceof Error && error.message ? error.message : String(error)

      throw new Error(
        `Unable to resolve whitelisted root address for connected account: ${message}`,
      )
    }
  }

  private async readChainEntitlement(
    chainId: SupportedChains,
    client?: PublicClient,
  ): Promise<bigint> {
    const contracts = this.getContractsForChain(chainId)
    const isPrimaryChain = chainId === this.chainId

    const resolvedClient = client
      ? client
      : isPrimaryChain
        ? this.publicClient
        : getRpcFallbackClient(chainId, this.rpcIterators)

    let altClient: PublicClient | undefined
    if (isPrimaryChain) {
      altClient = client ? resolvedClient : undefined
    } else {
      altClient = resolvedClient
    }

    // Use whitelisted root address for entitlement check
    // This enables connected accounts to claim on behalf of their main account
    const rootAddress = await this.getWhitelistedRootAddress()

    return this.readContract<bigint>(
      {
        address: contracts.ubiContract as Address,
        abi: ubiSchemeV2ABI,
        functionName: "checkEntitlement",
        args: [rootAddress],
      },
      altClient,
      chainId,
    )
  }

  private async findAltEntitlement(): Promise<AltClaimCandidate | null> {
    for (const fallbackChainId of this.fallbackChains) {
      const rpcUrls = [...(chainConfigs[fallbackChainId]?.rpcUrls ?? [])]
      if (!rpcUrls.length) {
        continue
      }

      for (let attempt = 0; attempt < rpcUrls.length; attempt++) {
        try {
          const amount = await this.readChainEntitlement(fallbackChainId)
          if (amount > 0n) {
            return {
              chainId: fallbackChainId,
              amount,
            }
          }
        } catch {
          // Try next RPC endpoint if the current one fails.
          continue
        }
      }
    }

    return null
  }

  static async init(
    props: Omit<ClaimSDKOptions, "account">,
  ): Promise<ClaimSDK> {
    const [account] = await props.walletClient.getAddresses()
    return new ClaimSDK({ account, ...props })
  }

  /**
   * Reads a contract function using publicClient.
   * @param params - Parameters for the contract read operation.
   * @returns The result of the contract read.
   * @throws If the contract read fails.
   */
  private async readContract<T>(
    params: {
      address: Address
      abi: any
      functionName: string
      args?: any[]
    },
    altClient?: PublicClient,
    targetChain?: SupportedChains,
    attempt = 0,
  ): Promise<T> {
    const chainId = targetChain ?? this.chainId
    const client = altClient || this.publicClient
    const errorPrefix = `Failed to read contract ${params.functionName}`
    try {
      return (await client.readContract({
        address: params.address,
        abi: params.abi,
        functionName: params.functionName,
        args: params.args || [],
        account: this.account,
      })) as T
    } catch (error: any) {
      // While fuse/celo work out of the box, there is a transport issue while connecting to XDC.
      // Resulting in --> Details: transports[i] is not a function
      // we implement a one-time retry with a fallback RPC from our list
      const combinedMessage = extractErrorMessage(error)
      if (shouldRetryRpcFallback(combinedMessage, chainId, attempt)) {
        const fallbackClient = getRpcFallbackClient(chainId, this.rpcIterators)
        return this.readContract<T>(
          params,
          fallbackClient,
          chainId,
          attempt + 1,
        )
      }

      throw new Error(`${errorPrefix}: ${combinedMessage}`)
    }
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
  ): Promise<TransactionReceipt> {
    if (!this.account) {
      throw new Error("No active wallet address found.")
    }

    const { request } = await this.publicClient.simulateContract({
      account: this.account,
      ...params,
    })

    const hash = await this.walletClient.writeContract(request)
    onHash?.(hash)

    // we wait one block
    // to prevent waitFor... to immediately throw an error
    await new Promise((res) => setTimeout(res, 5000))

    return waitForTransactionReceipt(this.publicClient, {
      hash,
      retryDelay: 5000,
    })
  }

  /**
   * Checks if the connected user is eligible to claim UBI for the current period.
   * Returns the amount they can claim (0 if not eligible or already claimed).
   * Does not check for whitelisting status.
   * @param pClient - Optional public client scoped to an alternative chain.
   * @param chainOverride - Optional chain id to evaluate entitlement against.
   * @returns The claimable amount in the smallest unit (e.g., wei).
   * @throws If the entitlement check fails.
   */
  async checkEntitlement(
    options: CheckEntitlementOptions = {},
  ): Promise<ClaimEntitlementResult> {
    const targetChain = options.chainOverride ?? this.chainId
    const clientOverride = options.publicClient
    const isPrimaryChain = targetChain === this.chainId

    const amount = await this.readChainEntitlement(targetChain, clientOverride)

    if (!isPrimaryChain) {
      const hasAltAmount = amount > 0n
      return {
        amount,
        altClaimAvailable: hasAltAmount,
        altChainId: hasAltAmount ? targetChain : null,
        altAmount: hasAltAmount ? amount : null,
      }
    }

    if (amount > 0n) {
      return {
        amount,
        altClaimAvailable: false,
        altChainId: null,
        altAmount: null,
      }
    }

    const altClaim = await this.findAltEntitlement()

    return {
      amount,
      altClaimAvailable: Boolean(altClaim),
      altChainId: altClaim?.chainId ?? null,
      altAmount: altClaim?.amount ?? null,
    }
  }

  /**
   * Checks the wallet claim status for the connected user.
   * This method provides a single point to check if the user can claim, needs verification, or has already claimed.
   * @returns WalletClaimStatus object with status, entitlement, and optionally nextClaimTime
   * @throws If unable to check wallet status or fetch required data.
   */
  async getWalletClaimStatus(): Promise<WalletClaimStatus> {
    const userAddress = this.account

    // 1. Check whitelisting status
    const { isWhitelisted } =
      await this.identitySDK.getWhitelistedRoot(userAddress)

    if (!isWhitelisted) {
      return {
        status: "not_whitelisted",
        entitlement: 0n,
      }
    }

    // 2. Check entitlement (if 0, user has already claimed or can't claim)
    const entitlementResult = await this.checkEntitlement()
    const entitlement = entitlementResult.amount

    if (entitlement > 0n) {
      return {
        status: "can_claim",
        entitlement,
      }
    }

    // 3. User is whitelisted but can't claim (already claimed)
    const nextClaimTime = await this.nextClaimTime()
    return {
      status: "already_claimed",
      entitlement: 0n,
      nextClaimTime,
    }
  }

  /**
   * Attempts to claim UBI for the connected user.
   * 1. Checks if the user is whitelisted using IdentitySDK.
   * 2. If not whitelisted, redirects to face verification and throws an error.
   * 3. If whitelisted, checks if the user can claim UBI from the pool using checkEntitlement.
   * 4. If whitelisted and can claim, checks if the user has sufficient balance.
   * 5. If the user cannot claim due to low balance, triggers a faucet request and waits.
   * 6. If whitelisted and can claim, proceeds to call the claim function on the UBIScheme contract.
   * @param txConfirm - Optional callback to confirm transactions before execution.
   * @returns The transaction receipt if the claim is successful.
   * @throws If the user is not whitelisted, not entitled to claim, balance check fails, or claim transaction fails.
   */
  async claim(
    txConfirm?: (message: string) => void | Promise<void>,
  ): Promise<TransactionReceipt | any> {
    const userAddress = this.account

    // 1. Check whitelisting status
    const { isWhitelisted } =
      await this.identitySDK.getWhitelistedRoot(userAddress)
    if (!isWhitelisted) {
      await this.fvRedirect()
      throw new Error("User requires identity verification.")
    }

    // 2. Check if user can claim from UBI pool
    const entitlementResult = await this.checkEntitlement()
    if (entitlementResult.amount === 0n) {
      throw new Error("No UBI available to claim for this period.")
    }

    // 3. Ensure the user has sufficient balance to claim
    const canClaim = await this.checkBalanceWithRetry(txConfirm)
    if (!canClaim) {
      throw new Error("Failed to meet balance threshold after faucet request.")
    }

    // 4. Execute the claim transaction
    try {
      return await this.submitAndWait({
        address: this.ubiSchemeAddress,
        abi: ubiSchemeV2ABI,
        functionName: "claim",
        chain: this.walletClient.chain,
      })
    } catch (error: any) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new Error(`Claim failed: ${error.shortMessage}`)
      }
      throw new Error(`Claim failed: ${error.message}`)
    }
  }

  /**
   * Redirects the user through the face-verification flow.
   * @throws If face verification redirect fails.
   */
  private async fvRedirect(): Promise<void> {
    const fvChainId = this.fvDefaultChain ?? this.chainId
    const fvLink = await this.identitySDK.generateFVLink(
      false,
      this.rdu,
      fvChainId,
    )
    if (typeof window !== "undefined") {
      window.location.href = fvLink
    } else {
      throw new Error(
        "Face verification redirect is only supported in browser environments.",
      )
    }
  }

  /**
   * Retrieves the next available claim time for the connected user.
   * Returns epoch time (0) if the user can claim now (entitlement > 0).
   * @returns The timestamp when the user can next claim UBI, or epoch time if can claim now.
   * @throws If unable to fetch the next claim time.
   */
  async nextClaimTime(): Promise<Date> {
    // Check if user can claim now (entitlement > 0)
    const entitlementResult = await this.checkEntitlement()
    if (entitlementResult.amount > 0n) {
      return new Date(0) // Return epoch time if can claim now
    }

    const [periodStart, currentDay] = await Promise.all([
      this.readContract<bigint>({
        address: this.ubiSchemeAddress,
        abi: ubiSchemeV2ABI,
        functionName: "periodStart",
      }),
      this.readContract<bigint>({
        address: this.ubiSchemeAddress,
        abi: ubiSchemeV2ABI,
        functionName: "currentDay",
      }),
    ])

    const periodStartMs = Number(periodStart) * 1000
    const startRef = new Date(periodStartMs + Number(currentDay) * DAY)

    const now = new Date()
    return startRef < now ? new Date(startRef.getTime() + DAY) : startRef
  }

  /**
   * Gets the number of claimers and total amount claimed for the current day.
   * @returns An object containing the number of claimers and total amount claimed.
   * @throws If unable to fetch daily stats.
   */
  async getDailyStats(): Promise<{ claimers: bigint; amount: bigint }> {
    const [claimers, amount] = await this.readContract<[bigint, bigint]>({
      address: this.ubiSchemeAddress,
      abi: ubiSchemeV2ABI,
      functionName: "getDailyStats",
    })
    return { claimers, amount }
  }

  /**
   * Triggers a faucet request to top up the user's balance.
   * @param txConfirm - Optional callback to confirm transactions before execution.
   * @throws If the faucet request fails.
   *
   * NOTE: Upgraded to contract-first flow:
   *  - Try on-chain faucet call (user signs) via `faucet.topWallet(address)`
   *  - Guard against gas>topping griefing and low native balance for publishing the tx
   *  - If on-chain path fails (or cannot sign/publish), fallback to backend `/verify/topWallet`
   *  - Throttled to at most once per hour per chain (localStorage)
   */
  async triggerFaucet(
    txConfirm?: (message: string) => void | Promise<void>,
  ): Promise<void> {
    // Call the txConfirm callback before executing the faucet transaction
    if (txConfirm) {
      const message =
        "A manual transaction needs to be signed in order to claim UBI. Please confirm the transaction in your wallet to proceed with the faucet request."
      await txConfirm(message)
    }

    // Delegate to shared utility to keep SDK lean while preserving this docstring.
    const chainId = this.getActiveChainId()
    const result = await triggerFaucetUtil({
      chainId,
      account: this.account,
      publicClient: this.publicClient,
      walletClient: this.walletClient,
      faucetAddress: this.faucetAddress,
      env: this.env,
      throttleMs: 60 * 60 * 1000, // 1 hour
    })

    // Optional: you can surface `result` to UI via an event/callback if desired.
    if (result === "error") {
      throw new Error("Faucet request failed")
    }
  }

  /**
   * Fetches faucet parameters (minTopping and toppingAmount).
   * @returns Faucet configuration parameters.
   * @throws If unable to fetch faucet parameters.
   */
  async getFaucetParameters(): Promise<{
    minTopping: number
    toppingAmount: bigint
  }> {
    const [minTopping, toppingAmount] = await Promise.all([
      this.readContract<number>({
        address: this.faucetAddress,
        abi: faucetABI,
        functionName: "minTopping",
      }),
      this.readContract<bigint>({
        address: this.faucetAddress,
        abi: faucetABI,
        functionName: "getToppingAmount",
      }),
    ])
    return { minTopping, toppingAmount }
  }

  /**
   * Checks the user's balance with retries, triggering a faucet request if needed.
   * @param txConfirm - Optional callback to confirm transactions before execution.
   * @returns True if the balance meets the threshold, false otherwise.
   * @throws If the maximum retries are exceeded or faucet request fails.
   */
  async checkBalanceWithRetry(
    txConfirm?: (message: string) => void | Promise<void>,
  ): Promise<boolean> {
    const maxRetries = 5
    const retryDelay = 5000

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Call the txConfirm callback before each faucet attempt if needed
      if (txConfirm && attempt === 1) {
        const message =
          "You might have to sign two transactions if you need additional gas to perform your UBI claim. "
        await txConfirm(message)
      }

      const chainId = this.getActiveChainId()
      const result = await triggerFaucetUtil({
        chainId,
        account: this.account,
        publicClient: this.publicClient,
        walletClient: this.walletClient,
        faucetAddress: this.faucetAddress,
        env: this.env,
        throttleMs: 60 * 60 * 1000, // 1 hour
      })

      // If we got "skipped" it means balance is sufficient or already topped recently
      if (result === "skipped") return true

      // If we successfully topped up, return true
      if (result === "topped_via_contract" || result === "topped_via_api")
        return true

      // If error and not last attempt, wait and retry
      if (result === "error" && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
        continue
      }

      // If error on last attempt, return false
      if (result === "error") return false
    }

    return false
  }
}

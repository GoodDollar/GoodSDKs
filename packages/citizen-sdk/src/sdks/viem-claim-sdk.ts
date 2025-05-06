import {
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
import { type contractEnv, contractAddresses, g$ABI } from "../constants"
import { Envs, faucetABI, getGasPrice, ubiSchemeV2ABI } from "../constants"

export interface ClaimSDKOptions {
  account: Address
  publicClient: PublicClient
  walletClient: WalletClient<any, Chain | undefined, Account | undefined>
  identitySDK: IdentitySDK
  rdu?: string
  env?: contractEnv
}

const DAY = 1000 * 60 * 60 * 24

export class ClaimSDK {
  private readonly publicClient: PublicClient
  private readonly walletClient: WalletClient<
    any,
    Chain | undefined,
    Account | undefined
  >
  private readonly identitySDK: IdentitySDK
  private readonly ubiSchemeAddress: Address
  private readonly faucetAddress: Address
  private readonly g$Address: Address
  private readonly account: Address
  private readonly env: contractEnv
  public readonly rdu: string

  constructor({
    account,
    publicClient,
    walletClient,
    identitySDK,
    rdu = window.location.href,
    env = "production",
  }: ClaimSDKOptions) {
    if (!walletClient.account) {
      throw new Error("ClaimSDK: WalletClient must have an account attached.")
    }
    this.publicClient = publicClient
    this.walletClient = walletClient
    this.identitySDK = identitySDK
    this.account = account
    this.rdu = rdu
    this.env = env

    const contractEnvAddresses = contractAddresses[env]

    if (!contractEnvAddresses) {
      throw new Error(
        `ClaimSDK: Contract addresses not found for configured env: '${env}'`,
      )
    }

    this.ubiSchemeAddress = contractEnvAddresses.ubiContract as Address
    this.faucetAddress = contractEnvAddresses.faucetContract as Address
    this.g$Address = contractEnvAddresses.g$Contract as Address
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
  private async readContract<T>(params: {
    address: Address
    abi: any
    functionName: string
    args?: any[]
  }): Promise<T> {
    try {
      return (await this.publicClient.readContract({
        address: params.address,
        abi: params.abi,
        functionName: params.functionName,
        args: params.args || [],
        account: this.account,
      })) as T
    } catch (error: any) {
      throw new Error(
        `Failed to read contract ${params.functionName}: ${error.message}`,
      )
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

    console.log("Transaction hash:", { hash })
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
   * @returns The claimable amount in the smallest unit (e.g., wei).
   * @throws If the entitlement check fails.
   */
  async checkEntitlement(): Promise<bigint> {
    return this.readContract<bigint>({
      address: this.ubiSchemeAddress,
      abi: ubiSchemeV2ABI,
      functionName: "checkEntitlement",
    })
  }

  /**
   * Attempts to claim UBI for the connected user.
   * 1. Checks if the user is whitelisted using IdentitySDK.
   * 2. If not whitelisted, redirects to face verification and throws an error.
   * 3. If whitelisted, checks if the user can claim UBI by ensuring sufficient balance.
   * 4. If the user cannot claim due to low balance, triggers a faucet request and waits.
   * 5. If whitelisted and can claim, proceeds to call the claim function on the UBIScheme contract.
   * @returns The transaction receipt if the claim is successful.
   * @throws If the user is not whitelisted, balance check fails, or claim transaction fails.
   */
  async claim(): Promise<TransactionReceipt | any> {
    const userAddress = this.account

    // 1. Check whitelisting status
    const { isWhitelisted } =
      await this.identitySDK.getWhitelistedRoot(userAddress)
    if (!isWhitelisted) {
      await this.fvRedirect()
      throw new Error("User requires identity verification.")
    }

    // 2. Ensure the user has sufficient balance to claim
    const canClaim = await this.checkBalanceWithRetry()
    if (!canClaim) {
      throw new Error("Failed to meet balance threshold after faucet request.")
    }

    // 3. Execute the claim transaction
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
    const fvLink = await this.identitySDK.generateFVLink(false, this.rdu, 42220)
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
   * @returns The timestamp when the user can next claim UBI.
   * @throws If unable to fetch the next claim time.
   */
  async nextClaimTime(): Promise<Date> {
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
   * @throws If the faucet request fails.
   */
  private async triggerFaucet(): Promise<void> {
    const { env } = this
    const { backend } = Envs[env as keyof typeof Envs]

    const body = JSON.stringify({
      chainId: this.walletClient.chain?.id,
      account: this.account,
    })

    const response = await fetch(`${backend}/verify/topWallet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    })

    if (!response.ok) {
      const errorMessage = await response.text()
      throw new Error(`Faucet request failed: ${errorMessage}`)
    }
  }

  /**
   * Checks if the user has sufficient balance to claim UBI.
   * @returns True if the user can claim, false otherwise.
   * @throws If gas price cannot be determined or balance check fails.
   */
  private async canClaim(): Promise<boolean> {
    const { minTopping, toppingAmount } = await this.getFaucetParameters()
    const chainId = this.walletClient.chain?.id

    const gasPrice = getGasPrice(chainId)
    if (!gasPrice) {
      throw new Error(
        "Cannot determine gasPrice for the current connected chain.",
      )
    }

    const minBalance = (chainId === 42220 ? 250000n : 150000n) * gasPrice
    const minThreshold =
      (toppingAmount * (100n - BigInt(minTopping))) / 100n || minBalance

    const balance = await this.readContract<bigint>({
      address: this.g$Address,
      abi: g$ABI,
      functionName: "balanceOf",
      args: [this.account],
    })

    return balance >= minThreshold
  }

  /**
   * Fetches faucet parameters (minTopping and toppingAmount).
   * @returns Faucet configuration parameters.
   * @throws If unable to fetch faucet parameters.
   */
  private async getFaucetParameters(): Promise<{
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
   * @returns True if the balance meets the threshold, false otherwise.
   * @throws If the maximum retries are exceeded or faucet request fails.
   */
  private async checkBalanceWithRetry(): Promise<boolean> {
    const maxRetries = 5
    const retryDelay = 5000

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const canClaim = await this.canClaim()
      if (canClaim) return true

      await this.triggerFaucet()
      await new Promise((resolve) => setTimeout(resolve, retryDelay))
    }

    return false
  }
}

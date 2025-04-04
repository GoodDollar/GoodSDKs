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
import { type contractEnv, ubiContractAddresses } from "../constants"
import { ubiSchemeV2ABI } from "../constants"

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
  private readonly account: Address
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

    const contractAddress = ubiContractAddresses[env]
    if (!contractAddress) {
      throw new Error(
        `ClaimSDK: UBIScheme contract address not found for env '${env}'`,
      )
    }
    this.ubiSchemeAddress = contractAddress as Address
  }

  static async init(
    props: Omit<ClaimSDKOptions, "account">,
  ): Promise<ClaimSDK> {
    const [account] = await props.walletClient.getAddresses()
    return new ClaimSDK({ account, ...props })
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
  ) {
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
   * Checks if the connected user is eligible to claim UBI for the current period.
   * Returns the amount they can claim (0 if not eligible or already claimed).
   * Does not check for whitelisting status.
   * @returns Promise<bigint> - The claimable amount in the smallest unit (e.g., wei).
   */
  async checkEntitlement(): Promise<bigint> {
    try {
      const entitlement = await this.publicClient.readContract({
        address: this.ubiSchemeAddress,
        abi: ubiSchemeV2ABI,
        functionName: "checkEntitlement",
        account: this.account,
      })
      return entitlement
    } catch (error) {
      console.error("ClaimSDK: Error checking entitlement:", error)
      throw new Error("Failed to check claim entitlement.")
    }
  }

  /**
   * Attempts to claim UBI for the connected user.
   * 1. Checks if the user is whitelisted using IdentitySDK.
   * 2. If not whitelisted, throws UserNotWhitelistedError.
   * 3. If whitelisted, proceeds to call the claim function on the UBIScheme contract.
   * @throws {UserNotWhitelistedError} If the user requires identity verification.
   * @throws {ClaimError} If any other error occurs during the claim process.
   * @returns {Promise<WriteContractReturnType>} The transaction hash of the claim.
   */
  async claim(): Promise<TransactionReceipt | null> {
    const userAddress = this.account

    // 1. Check whitelisting status
    const { isWhitelisted } =
      await this.identitySDK.getWhitelistedRoot(userAddress)

    // 2. Handle non-whitelisted users
    if (!isWhitelisted) {
      await this.fvRedirect()
      return null
    }

    // // 3. Proceed with claim if whitelisted
    try {
      const hash = await this.submitAndWait({
        address: this.ubiSchemeAddress,
        abi: ubiSchemeV2ABI,
        functionName: "claim",
        chain: this.walletClient.chain,
      })

      console.log(`ClaimSDK: Claim transaction sent: ${hash}`)
      return hash
    } catch (error: any) {
      console.error("ClaimSDK: Error executing claim transaction:", error)
      if (error instanceof ContractFunctionExecutionError) {
        throw new Error(`Claim failed: ${error.shortMessage}`)
      }
      throw new Error(
        "An unexpected error occurred while sending the claim transaction.",
      )
    }
  }

  /**
   * Redirects the user through the face-verification flow.
   */
  private async fvRedirect(): Promise<void> {
    try {
      const fvLink = await this.identitySDK.generateFVLink(
        false,
        this.rdu,
        42220,
      )
      window.location.href = fvLink
    } catch (error) {
      console.error("ClaimSDK: Face verification redirect failed:", error)
      throw new Error("Failed to initiate face verification.")
    }
  }

  /**
   * Retrieves the next available claim time for the connected user.
   * @returns Promise<Date> - The timestamp when the user can next claim UBI.
   * @throws If unable to fetch the next claim time.
   */
  async nextClaimTime(): Promise<Date> {
    try {
      const [periodStart, currentDay] = await Promise.all([
        this.publicClient.readContract({
          address: this.ubiSchemeAddress,
          abi: ubiSchemeV2ABI,
          functionName: "periodStart",
          args: [],
        }),
        this.publicClient.readContract({
          address: this.ubiSchemeAddress,
          abi: ubiSchemeV2ABI,
          functionName: "currentDay",
          args: [],
        }),
      ])

      const periodStartMs = Number(periodStart) * 1000
      const startRef = new Date(periodStartMs + Number(currentDay) * DAY)

      const now = new Date()
      const nextClaimDate =
        startRef < now ? new Date(startRef.getTime() + DAY) : startRef

      return nextClaimDate
    } catch (error: any) {
      console.error("ClaimSDK: Error fetching next claim time:", error)
      throw new Error("Failed to retrieve next claim time.")
    }
  }

  /**
   * Gets the number of claimers and total amount claimed for the current day.
   * @returns Promise<{ claimers: bigint; amount: bigint }>
   */
  async getDailyStats(): Promise<{ claimers: bigint; amount: bigint }> {
    try {
      const [claimers, amount] = await this.publicClient.readContract({
        address: this.ubiSchemeAddress,
        abi: ubiSchemeV2ABI,
        functionName: "getDailyStats",
      })
      return { claimers, amount }
    } catch (error) {
      console.error("ClaimSDK: Error fetching daily stats:", error)
      throw new Error("Failed to fetch daily stats.")
    }
  }
}

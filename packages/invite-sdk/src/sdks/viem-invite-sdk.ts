import {
  type Address,
  type PublicClient,
  type WalletClient,
  type Account,
  type Chain,
  type TransactionReceipt,
  decodeEventLog,
  zeroAddress,
} from "viem"
import { waitForTransactionReceipt } from "viem/actions"
import {
  type contractEnv,
  SupportedChains,
  CHAIN_DECIMALS,
  isSupportedChain,
} from "@goodsdks/citizen-sdk"

import { invitesV2ABI } from "../abi"
import { resolveInvitesAddress } from "../constants"
import type {
  InviteUser,
  InviteLevel,
  InviteStats,
  BountyResult,
  BountyEligibilityDetails,
} from "../types"
import { InviteSDKError } from "../types"

/** Identity ABI — only the isWhitelisted function needed for diagnostic checks. */
const identityABI = [
  {
    type: "function",
    name: "isWhitelisted",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Maps a contract custom-error name to an InviteSDKError.
 * Parses the error message or shortMessage produced by viem's
 * ContractFunctionExecutionError to extract the error name.
 */
function mapContractError(error: unknown): InviteSDKError {
  const msg =
    error instanceof Error ? error.message : String(error)
  const shortMsg =
    (error as any)?.shortMessage ?? ""
  const combined = `${shortMsg} ${msg}`.toLowerCase()

  if (combined.includes("not_active") || combined.includes("isactive"))
    return new InviteSDKError("contract is not active", "NOT_ACTIVE")
  if (combined.includes("invite_code_in_use") || combined.includes("already in use"))
    return new InviteSDKError("invite code already in use", "INVITE_CODE_IN_USE")
  if (combined.includes("self_invite") || combined.includes("self invite"))
    return new InviteSDKError("cannot invite yourself", "SELF_INVITE")
  if (combined.includes("user_already_joined") || combined.includes("already joined"))
    return new InviteSDKError("user has already joined", "USER_ALREADY_JOINED")
  if (combined.includes("not_eligible_bounty") || combined.includes("not elligble"))
    return new InviteSDKError(
      "invitee not yet eligible for bounty",
      "NOT_ELIGIBLE_BOUNTY",
    )

  return new InviteSDKError(msg, "UNKNOWN")
}

/** Extracts all InviterBounty logs from a receipt. */
function parseBountyLogs(
  receipt: TransactionReceipt,
): Array<{
  inviter: Address
  invitee: Address
  bountyPaid: bigint
  inviterLevel: bigint
  earnedLevel: boolean
}> {
  const results: ReturnType<typeof parseBountyLogs> = []
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: invitesV2ABI,
        data: log.data,
        topics: log.topics,
      })
      if (decoded.eventName === "InviterBounty") {
        const args = decoded.args as {
          inviter: Address
          invitee: Address
          bountyPaid: bigint
          inviterLevel: bigint
          earnedLevel: boolean
        }
        results.push(args)
      }
    } catch {
      // not an InviterBounty log — skip
    }
  }
  return results
}

// ─── SDK Options ──────────────────────────────────────────────────────────────

export interface InviteSDKOptions {
  publicClient: PublicClient
  walletClient: WalletClient<any, Chain | undefined, Account | undefined>
  env?: contractEnv
  /** Override the contract address (useful for testing). */
  contractAddress?: Address
}

// ─── SDK Class ────────────────────────────────────────────────────────────────

/**
 * Viem-based SDK for the InvitesV2 contract.
 *
 * Exposes typed read and write helpers for:
 * - Querying invite/user/level state
 * - Joining with an invite code
 * - Collecting single or batch bounties
 *
 * All write methods:
 * 1. Run pre-checks and throw `InviteSDKError` on failure.
 * 2. Simulate the transaction before submission.
 * 3. Return a parsed result from the event log.
 *
 * Admin-only functions (`setLevel`, `setActive`, `setMinimums`, `setCampaignCode`, `end`)
 * are intentionally omitted — they are governance-gated and out of scope for the public SDK.
 */
export class InviteSDK {
  readonly publicClient: PublicClient
  readonly walletClient: WalletClient<any, Chain | undefined, Account | undefined>
  readonly contractAddress: Address
  readonly chainId: SupportedChains
  readonly env: contractEnv
  private account: Address

  private constructor(
    options: Required<InviteSDKOptions> & { account: Address; chainId: SupportedChains },
  ) {
    this.publicClient = options.publicClient
    this.walletClient = options.walletClient
    this.contractAddress = options.contractAddress
    this.env = options.env
    this.chainId = options.chainId
    this.account = options.account
  }

  /**
   * Asynchronously constructs an `InviteSDK` instance.
   * Resolves the connected account address from the wallet client.
   */
  static async init(options: InviteSDKOptions): Promise<InviteSDK> {
    const { publicClient, walletClient, env = "production" } = options

    const chainId = walletClient.chain?.id
    if (!isSupportedChain(chainId)) {
      throw new Error(
        `InviteSDK: unsupported chain id ${chainId}. Connected wallet must be on Fuse, Celo, or XDC.`,
      )
    }

    const contractAddress =
      options.contractAddress ?? resolveInvitesAddress(env, chainId)

    const [account] = await walletClient.getAddresses()
    if (!account) {
      throw new Error("InviteSDK: walletClient has no account attached.")
    }

    return new InviteSDK({
      publicClient,
      walletClient,
      env,
      contractAddress,
      account,
      chainId,
    })
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async read<T = unknown>(
    functionName: string,
    args: unknown[] = [],
  ): Promise<T> {
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: invitesV2ABI,
      functionName: functionName as any,
      args: args as any,
    })
    return result as T
  }

  private async submitAndWait(
    functionName: string,
    args: unknown[] = [],
  ): Promise<TransactionReceipt> {
    const { request } = await this.publicClient.simulateContract({
      address: this.contractAddress,
      abi: invitesV2ABI,
      functionName: functionName as any,
      args: args as any,
      account: this.account,
    })

    const hash = await this.walletClient.writeContract(request)

    // Give the node a moment before polling
    await new Promise((res) => setTimeout(res, 2000))

    return waitForTransactionReceipt(this.publicClient, {
      hash,
      retryDelay: 5000,
    })
  }

  // ─── Read methods ──────────────────────────────────────────────────────────

  /**
   * Returns whether the invite campaign is currently active.
   */
  async getActive(): Promise<boolean> {
    return this.read<boolean>("active")
  }

  /**
   * Returns the global minimumClaims and minimumDays thresholds
   * used by `canCollectBountyFor`.
   */
  async getMinimums(): Promise<{ minimumClaims: number; minimumDays: number }> {
    const [minimumClaims, minimumDays] = await Promise.all([
      this.read<number>("minimumClaims"),
      this.read<number>("minimumDays"),
    ])
    return { minimumClaims, minimumDays }
  }

  /**
   * Returns the full `InviteUser` struct for an address.
   * Viem returns multiple named outputs as a named-tuple (object with positional access).
   */
  async getUser(address: Address): Promise<InviteUser> {
    const result = await this.read<
      readonly [Address, `0x${string}`, boolean, bigint, bigint, bigint, bigint, bigint, bigint]
    >("users", [address])

    return {
      invitedBy: result[0],
      inviteCode: result[1],
      bountyPaid: result[2],
      level: result[3],
      levelStarted: result[4],
      totalApprovedInvites: result[5],
      totalEarned: result[6],
      joinedAt: result[7],
      bountyAtJoin: result[8],
    }
  }

  /**
   * Returns the `InviteLevel` configuration for level `lvl`.
   * `bounty` is in G$ cents (2 decimals on Fuse, 18 on Celo).
   */
  async getLevel(lvl: number): Promise<InviteLevel> {
    const result = await this.read<readonly [bigint, bigint, bigint]>("levels", [BigInt(lvl)])
    return { toNext: result[0], bounty: result[1], daysToComplete: result[2] }
  }

  /**
   * Returns aggregated protocol statistics.
   */
  async getStats(): Promise<InviteStats> {
    const result = await this.read<readonly [bigint, bigint, bigint]>("stats")
    return {
      totalApprovedInvites: result[0],
      totalBountiesPaid: result[1],
      totalInvited: result[2],
    }
  }

  /**
   * Returns all invitee addresses registered under `inviter`.
   */
  async getInvitees(inviter: Address): Promise<Address[]> {
    return this.read<Address[]>("getInvitees", [inviter])
  }

  /**
   * Returns pending (unpaid) invitee addresses under `inviter`.
   */
  async getPendingInvitees(inviter: Address): Promise<Address[]> {
    return this.read<Address[]>("getPendingInvitees", [inviter])
  }

  /**
   * Returns the count of pending bounties for `inviter`.
   */
  async getPendingBounties(inviter: Address): Promise<bigint> {
    return this.read<bigint>("getPendingBounties", [inviter])
  }

  /**
   * Primary eligibility gate — returns true if `invitee` is currently
   * eligible for a bounty payout.
   *
   * Checks: active state, whitelist, minimumDays, minimumClaims,
   * unpaid bounty flag, and chain constraints.
   */
  async canCollectBounty(invitee: Address): Promise<boolean> {
    return this.read<boolean>("canCollectBountyFor", [invitee])
  }

  /**
   * Resolves an invite code (bytes32) to the address that registered it.
   * Returns zeroAddress if the code is not yet registered.
   */
  async resolveCode(code: `0x${string}`): Promise<Address> {
    return this.read<Address>("codeToUser", [code])
  }

  /**
   * Returns the address of the linked Identity contract.
   */
  async getIdentityAddress(): Promise<Address> {
    return this.read<Address>("getIdentity")
  }

  /**
   * Checks eligibility and returns a detailed breakdown of the blockers.
   * Useful for surfacing a human-readable reason when `canCollectBounty` returns false.
   *
   * @param invitee - Address to evaluate.
   * @returns Eligibility flag and diagnostic details.
   */
  async checkEligibilityDetails(invitee: Address): Promise<{
    eligible: boolean
    details: BountyEligibilityDetails
  }> {
    const identityAddress = await this.read<Address>("getIdentity")

    const [isActive, eligible, minimumClaims, minimumDays, user] =
      await Promise.all([
        this.read<boolean>("active"),
        this.read<boolean>("canCollectBountyFor", [invitee]),
        this.read<number>("minimumClaims"),
        this.read<number>("minimumDays"),
        this.getUser(invitee),
      ])

    let inviteeWhitelisted = false
    let inviterWhitelisted: boolean | null = null
    let reverificationDue = false

    if (identityAddress !== zeroAddress) {
      try {
        inviteeWhitelisted = (await this.publicClient.readContract({
          address: identityAddress,
          abi: identityABI,
          functionName: "isWhitelisted",
          args: [invitee],
        })) as boolean
      } catch {
        // Identity contract unavailable — treat as not whitelisted
      }

      if (user.invitedBy !== zeroAddress) {
        try {
          inviterWhitelisted = (await this.publicClient.readContract({
            address: identityAddress,
            abi: identityABI,
            functionName: "isWhitelisted",
            args: [user.invitedBy],
          })) as boolean
        } catch {
          inviterWhitelisted = null
        }
      }

      // Reverification is due when the user exists in identity storage but
      // isWhitelisted() returns false (their auth period has lapsed).
      reverificationDue =
        !inviteeWhitelisted ||
        (inviterWhitelisted !== null && !inviterWhitelisted)
    }

    return {
      eligible,
      details: {
        isActive,
        inviteeWhitelisted,
        inviterWhitelisted,
        minimumClaims,
        minimumDays,
        reverificationDue,
      },
    }
  }

  // ─── Write methods ─────────────────────────────────────────────────────────

  /**
   * Registers the caller's invite code and optionally binds to an inviter.
   *
   * Pre-checks (before simulation):
   * - The contract must be active.
   * - `myCode` must not already be in use.
   * - The caller must not have already joined.
   * - `myCode` and `inviterCode` must not be the same.
   *
   * @param myCode     - bytes32 invite code for the caller.
   * @param inviterCode - bytes32 invite code of the inviter (use `zeroHash` for no inviter).
   * @returns The transaction hash.
   */
  async join(
    myCode: `0x${string}`,
    inviterCode: `0x${string}`,
  ): Promise<`0x${string}`> {
    // Pre-checks
    const [isActive, existingOwner, callerUser] = await Promise.all([
      this.read<boolean>("active"),
      this.read<Address>("codeToUser", [myCode]),
      this.getUser(this.account),
    ])

    if (!isActive) {
      throw new InviteSDKError("contract is not active", "NOT_ACTIVE")
    }
    if (existingOwner !== zeroAddress) {
      throw new InviteSDKError("invite code already in use", "INVITE_CODE_IN_USE")
    }
    if (callerUser.joinedAt > 0n) {
      throw new InviteSDKError("user has already joined", "USER_ALREADY_JOINED")
    }
    if (
      inviterCode !== ("0x" + "00".repeat(32) as `0x${string}`) &&
      myCode === inviterCode
    ) {
      throw new InviteSDKError("cannot invite yourself", "SELF_INVITE")
    }

    try {
      const receipt = await this.submitAndWait("join", [myCode, inviterCode])
      return receipt.transactionHash
    } catch (err) {
      throw mapContractError(err)
    }
  }

  /**
   * Collects the bounty for a single invitee.
   *
   * Pre-checks (before simulation):
   * - The contract must be active.
   * - `canCollectBountyFor(invitee)` must return true.
   *
   * @param invitee - Address of the invitee.
   * @returns Parsed `BountyResult` from the `InviterBounty` event.
   */
  async collectBounty(invitee: Address): Promise<BountyResult> {
    const [isActive, eligible] = await Promise.all([
      this.read<boolean>("active"),
      this.read<boolean>("canCollectBountyFor", [invitee]),
    ])

    if (!isActive) {
      throw new InviteSDKError("contract is not active", "NOT_ACTIVE")
    }
    if (!eligible) {
      const { details } = await this.checkEligibilityDetails(invitee)
      const reason = [
        !details.inviteeWhitelisted && "invitee not whitelisted",
        details.inviterWhitelisted === false && "inviter not whitelisted",
        details.reverificationDue && "reverification is due",
        `minimumClaims=${details.minimumClaims} minimumDays=${details.minimumDays}`,
      ]
        .filter(Boolean)
        .join("; ")
      throw new InviteSDKError(
        `invitee not yet eligible for bounty: ${reason}`,
        "NOT_ELIGIBLE_BOUNTY",
      )
    }

    try {
      const receipt = await this.submitAndWait("bountyFor", [invitee])
      const [parsed] = parseBountyLogs(receipt)
      if (!parsed) {
        // No InviterBounty event — bounty was zero or already paid
        return {
          txHash: receipt.transactionHash,
          invitee,
          inviter: this.account,
          bountyPaid: 0n,
          inviterLevel: 0n,
          earnedLevel: false,
        }
      }
      return {
        txHash: receipt.transactionHash,
        invitee: parsed.invitee,
        inviter: parsed.inviter,
        bountyPaid: parsed.bountyPaid,
        inviterLevel: parsed.inviterLevel,
        earnedLevel: parsed.earnedLevel,
      }
    } catch (err) {
      throw mapContractError(err)
    }
  }

  /**
   * Collects all pending bounties for the connected wallet (batch payout).
   *
   * Pre-checks (before simulation):
   * - The contract must be active.
   *
   * @returns Array of `BountyResult` entries, one per `InviterBounty` event in the receipt.
   */
  async collectAllBounties(): Promise<BountyResult[]> {
    const isActive = await this.read<boolean>("active")
    if (!isActive) {
      throw new InviteSDKError("contract is not active", "NOT_ACTIVE")
    }

    try {
      const receipt = await this.submitAndWait("collectBounties")
      return parseBountyLogs(receipt).map((parsed) => ({
        txHash: receipt.transactionHash,
        invitee: parsed.invitee,
        inviter: parsed.inviter,
        bountyPaid: parsed.bountyPaid,
        inviterLevel: parsed.inviterLevel,
        earnedLevel: parsed.earnedLevel,
      }))
    } catch (err) {
      throw mapContractError(err)
    }
  }

  // ─── Utility ───────────────────────────────────────────────────────────────

  /**
   * Returns the current account address used for write operations.
   */
  getAccount(): Address {
    return this.account
  }
}

// ─── formatBounty helper ──────────────────────────────────────────────────────

/**
 * Converts a bounty amount stored in G$ cents to a human-readable G$ string.
 *
 * On **Fuse** the token has 2 decimal places, so the contract stores amounts
 * already in cents (divide by 100 to get G$).
 *
 * On **Celo** the token has 18 decimal places, so the raw value is in wei-like
 * units (divide by 1e18 to get G$).
 *
 * @param cents  - Raw bounty value from the contract.
 * @param chainId - Chain the contract is deployed on.
 * @returns A human-readable G$ string, e.g. `"12.50"`.
 */
export function formatBounty(cents: bigint, chainId: SupportedChains): string {
  const decimals = CHAIN_DECIMALS[chainId] ?? 2
  const divisor = BigInt(10 ** decimals)
  const whole = cents / divisor
  const remainder = cents % divisor

  const fractionStr = remainder.toString().padStart(decimals, "0")
  // Trim trailing zeros but keep at least 2 decimal places
  const trimmed = fractionStr.replace(/0+$/, "").padEnd(2, "0")

  return `${whole}.${trimmed}`
}

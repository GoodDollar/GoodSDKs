import { Address } from "viem"

// ─── Core data types ─────────────────────────────────────────────────────────

/**
 * State of an address in the InvitesV2 contract (from `users(address)`).
 */
export interface InviteUser {
  /** Address of the account that invited this user (zeroAddress if none). */
  invitedBy: Address
  /** The bytes32 invite code registered by this user. */
  inviteCode: `0x${string}`
  /** True when this user's invitee-side bounty has been paid. */
  bountyPaid: boolean
  /** Current inviter level (0-based). */
  level: bigint
  /** Block timestamp when the current level was started. */
  levelStarted: bigint
  /** Total approved invites at this level. */
  totalApprovedInvites: bigint
  /** Total G$ cents earned from bounties. */
  totalEarned: bigint
  /** Block timestamp when the user called join(). */
  joinedAt: bigint
  /** Bounty amount (G$ cents) at the time of join. */
  bountyAtJoin: bigint
}

/**
 * Inviter level configuration (from `levels(uint256)`).
 * `bounty` is stored in **G$ cents** (2 decimal places on Fuse, 18 on Celo).
 */
export interface InviteLevel {
  /** Number of approved invites required to advance to the next level. */
  toNext: bigint
  /** Bounty paid to the inviter per eligible invitee (G$ cents). */
  bounty: bigint
  /** Time window in days within which invites must be achieved. */
  daysToComplete: bigint
}

/**
 * Aggregated protocol statistics (from `stats()`).
 */
export interface InviteStats {
  /** Total number of approved invites across all users. */
  totalApprovedInvites: bigint
  /** Total bounties paid out (G$ cents). */
  totalBountiesPaid: bigint
  /** Total number of invitees who called join(). */
  totalInvited: bigint
}

/**
 * Result returned by `collectBounty` and `collectAllBounties`.
 * Contains parsed data from the `InviterBounty` event log.
 */
export interface BountyResult {
  /** Transaction hash of the payout tx. */
  txHash: `0x${string}`
  /** Address of the invitee whose join triggered this bounty. */
  invitee: Address
  /** Address of the inviter who received the payout. */
  inviter: Address
  /** Bounty amount paid (G$ cents). */
  bountyPaid: bigint
  /** Inviter's level at the time of payout. */
  inviterLevel: bigint
  /** True if the inviter advanced to a new level from this payout. */
  earnedLevel: boolean
}

// ─── Eligibility diagnostic ──────────────────────────────────────────────────

/**
 * Detailed breakdown of why `canCollectBountyFor` returned false.
 * Returned alongside the boolean result so callers can surface the root cause.
 */
export interface BountyEligibilityDetails {
  /** Whether the invites contract is currently active. */
  isActive: boolean
  /** Whether the invitee passes the identity whitelist check. */
  inviteeWhitelisted: boolean
  /** Whether the inviter passes the identity whitelist check (if applicable). */
  inviterWhitelisted: boolean | null
  /** Global minimum-claims threshold. */
  minimumClaims: number
  /** Global minimum-days threshold. */
  minimumDays: number
  /**
   * True when the invitee (or inviter) is stored in identity but
   * `isWhitelisted()` returns false, meaning reverification is due.
   */
  reverificationDue: boolean
}

// ─── SDK Options ─────────────────────────────────────────────────────────────

export type { contractEnv, SupportedChains } from "@goodsdks/citizen-sdk"

// ─── Error class ─────────────────────────────────────────────────────────────

/**
 * Typed error thrown by InviteSDK when a precondition fails or the contract
 * reverts with a known custom error.
 */
export class InviteSDKError extends Error {
  /** Machine-readable error code matching the contract's custom error name. */
  readonly errorCode:
    | "NOT_ACTIVE"
    | "INVITE_CODE_IN_USE"
    | "SELF_INVITE"
    | "USER_ALREADY_JOINED"
    | "NOT_ELIGIBLE_BOUNTY"
    | "UNKNOWN"

  constructor(
    message: string,
    errorCode: InviteSDKError["errorCode"] = "UNKNOWN",
  ) {
    super(message)
    this.name = "InviteSDKError"
    this.errorCode = errorCode
  }
}

import { parseAbi } from "viem"

/**
 * ABI for the InvitesV2 contract (v2.4, UUPS-upgradeable).
 * Covers invite code registration, inviter-level progression,
 * eligibility gating, and single/batch bounty payout.
 *
 * @see https://github.com/GoodDollar/GoodProtocol/blob/master/contracts/invite/InvitesV2.sol
 */
export const invitesV2ABI = parseAbi([
  // ─── View functions ────────────────────────────────────────────────────────
  "function active() view returns (bool ok)",
  "function minimumClaims() view returns (uint8 n)",
  "function minimumDays() view returns (uint8 n)",
  "function getIdentity() view returns (address identity)",
  "function users(address user) view returns (address invitedBy, bytes32 inviteCode, bool bountyPaid, uint256 level, uint256 levelStarted, uint256 totalApprovedInvites, uint256 totalEarned, uint256 joinedAt, uint256 bountyAtJoin)",
  "function levels(uint256 lvl) view returns (uint256 toNext, uint256 bounty, uint256 daysToComplete)",
  "function stats() view returns (uint256 totalApprovedInvites, uint256 totalBountiesPaid, uint256 totalInvited)",
  "function getInvitees(address _inviter) view returns (address[] invitees)",
  "function getPendingInvitees(address _inviter) view returns (address[] pending)",
  "function getPendingBounties(address _inviter) view returns (uint256 count)",
  "function canCollectBountyFor(address _invitee) view returns (bool ok)",
  "function codeToUser(bytes32 code) view returns (address user)",
  "function levelExpirationEnabled() view returns (bool ok)",
  "function version() pure returns (string v)",

  // ─── Write functions ────────────────────────────────────────────────────────
  /**
   * Registers myCode and optionally binds to the inviter identified by inviterCode.
   * Errors: NOT_ACTIVE, INVITE_CODE_IN_USE, SELF_INVITE, USER_ALREADY_JOINED
   */
  "function join(bytes32 _myCode, bytes32 _inviterCode) nonpayable",
  /**
   * Single-invitee payout. Revalidates eligibility before transferring bounty shares.
   * Errors: NOT_ACTIVE, NOT_ELIGIBLE_BOUNTY
   */
  "function bountyFor(address _invitee) nonpayable returns (uint256 bounty)",
  /**
   * Batch payout over caller's pending invitees.
   * Errors: NOT_ACTIVE
   */
  "function collectBounties() nonpayable",

  // ─── Events ─────────────────────────────────────────────────────────────────
  "event InviteeJoined(address indexed inviter, address indexed invitee)",
  "event InviterBounty(address indexed inviter, address indexed invitee, uint256 bountyPaid, uint256 inviterLevel, bool earnedLevel)",

  // ─── Custom errors ───────────────────────────────────────────────────────────
  "error NOT_ACTIVE()",
  "error INVITE_CODE_IN_USE()",
  "error SELF_INVITE()",
  "error USER_ALREADY_JOINED()",
  "error NOT_ELIGIBLE_BOUNTY()",
])

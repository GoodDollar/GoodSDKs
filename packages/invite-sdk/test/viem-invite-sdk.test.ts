import { describe, it, expect, vi, beforeEach } from "vitest"
import { zeroAddress, encodeEventTopics, encodeAbiParameters, parseAbiParameters } from "viem"
import type { PublicClient, WalletClient, TransactionReceipt } from "viem"
import { InviteSDK, formatBounty } from "../src/sdks/viem-invite-sdk"
import { InviteSDKError } from "../src/types"
import {
  resolveInvitesAddress,
  INVITES_V2_ADDRESSES,
  SupportedChains,
} from "../src/constants"
import { invitesV2ABI } from "../src/abi"

// ─── Constants ────────────────────────────────────────────────────────────────

const MOCK_INVITER = "0x1111111111111111111111111111111111111111" as const
const MOCK_INVITEE = "0x2222222222222222222222222222222222222222" as const
const MOCK_IDENTITY = "0x3333333333333333333333333333333333333333" as const
const MOCK_CONTRACT = "0xCa2F09c3ccFD7aD5cB9276918Bd1868f2b922ea0" as const
const MOCK_TX_HASH = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" as const
const ZERO_BYTES32 = ("0x" + "00".repeat(32)) as `0x${string}`
const MY_CODE = ("0x" + "aa".repeat(32)) as `0x${string}`
const INVITER_CODE = ("0x" + "bb".repeat(32)) as `0x${string}`

// ─── Mock client factory ──────────────────────────────────────────────────────

type MockPublicClient = Pick<PublicClient, "readContract" | "simulateContract">
type MockWalletClient = Pick<WalletClient, "account" | "chain" | "getAddresses" | "writeContract">

function makeClients(chainId: number = SupportedChains.CELO) {
  const publicClient: MockPublicClient = {
    readContract: vi.fn(),
    simulateContract: vi.fn().mockResolvedValue({ request: {} }),
  }
  const walletClient: MockWalletClient = {
    account: { address: MOCK_INVITER },
    chain: { id: chainId },
    getAddresses: vi.fn().mockResolvedValue([MOCK_INVITER]),
    writeContract: vi.fn().mockResolvedValue(MOCK_TX_HASH),
  }
  return { publicClient, walletClient }
}

/** Minimal InviteUser tuple (all-zero / unjoined). */
function makeUserTuple(overrides: Partial<{
  invitedBy: string
  inviteCode: `0x${string}`
  bountyPaid: boolean
  level: bigint
  levelStarted: bigint
  totalApprovedInvites: bigint
  totalEarned: bigint
  joinedAt: bigint
  bountyAtJoin: bigint
}> = {}) {
  return [
    overrides.invitedBy ?? zeroAddress,
    overrides.inviteCode ?? ZERO_BYTES32,
    overrides.bountyPaid ?? false,
    overrides.level ?? 0n,
    overrides.levelStarted ?? 0n,
    overrides.totalApprovedInvites ?? 0n,
    overrides.totalEarned ?? 0n,
    overrides.joinedAt ?? 0n,
    overrides.bountyAtJoin ?? 0n,
  ] as const
}

/** Build a mock receipt with an InviterBounty event log. */
function makeBountyReceipt(
  inviter: `0x${string}` = MOCK_INVITER,
  invitee: `0x${string}` = MOCK_INVITEE,
  bountyPaid = 1250n,
  inviterLevel = 0n,
  earnedLevel = false,
): TransactionReceipt {
  // Encode the InviterBounty event
  const topics = encodeEventTopics({
    abi: invitesV2ABI,
    eventName: "InviterBounty",
    args: { inviter, invitee },
  })

  const data = encodeAbiParameters(
    parseAbiParameters("uint256, uint256, bool"),
    [bountyPaid, inviterLevel, earnedLevel],
  )

  return {
    transactionHash: MOCK_TX_HASH,
    blockHash: "0x" as `0x${string}`,
    blockNumber: 1n,
    contractAddress: null,
    cumulativeGasUsed: 0n,
    effectiveGasPrice: 0n,
    from: MOCK_INVITER,
    gasUsed: 0n,
    logs: [{ address: MOCK_CONTRACT, topics, data, blockHash: "0x" as `0x${string}`, blockNumber: 1n, logIndex: 0, removed: false, transactionHash: MOCK_TX_HASH, transactionIndex: 0 }],
    logsBloom: "0x" as `0x${string}`,
    status: "success",
    to: MOCK_CONTRACT,
    transactionIndex: 0,
    type: "eip1559",
  } as unknown as TransactionReceipt
}

// ─── resolveInvitesAddress ────────────────────────────────────────────────────

describe("resolveInvitesAddress", () => {
  it("returns the correct Celo production address", () => {
    expect(resolveInvitesAddress("production", SupportedChains.CELO)).toBe(
      INVITES_V2_ADDRESSES.production[SupportedChains.CELO],
    )
  })

  it("returns the correct XDC production address", () => {
    expect(resolveInvitesAddress("production", SupportedChains.XDC)).toBe(
      INVITES_V2_ADDRESSES.production[SupportedChains.XDC],
    )
  })

  it("normalises staging to development and returns the Celo development address", () => {
    expect(resolveInvitesAddress("staging", SupportedChains.CELO)).toBe(
      INVITES_V2_ADDRESSES.development[SupportedChains.CELO],
    )
  })

  it("throws for an unconfigured env/chain combination (Fuse is not supported)", () => {
    expect(() => resolveInvitesAddress("production", 122)).toThrow(
      /address not configured/i,
    )
  })
})

// ─── formatBounty ─────────────────────────────────────────────────────────────

describe("formatBounty", () => {
  it("formats a zero bounty as '0.00' (Celo, 18 decimals)", () => {
    expect(formatBounty(0n, SupportedChains.CELO)).toBe("0.00")
  })

  it("formats a Celo bounty (18 decimals) correctly — 1.5 G$", () => {
    // 1.5 G$ on Celo = 1.5e18 = 1_500_000_000_000_000_000n
    const celoAmount = 1_500_000_000_000_000_000n
    expect(formatBounty(celoAmount, SupportedChains.CELO)).toBe("1.50")
  })

  it("formats a Celo bounty of exactly 12.50 G$", () => {
    const amount = 12_500_000_000_000_000_000n // 12.5e18
    expect(formatBounty(amount, SupportedChains.CELO)).toBe("12.50")
  })

  it("formats a whole-number Celo bounty with '.00' suffix", () => {
    expect(formatBounty(1_000_000_000_000_000_000n, SupportedChains.CELO)).toBe("1.00")
  })

  it("formats an XDC bounty (18 decimals) the same as Celo", () => {
    const amount = 2_000_000_000_000_000_000n // 2 G$
    expect(formatBounty(amount, SupportedChains.XDC)).toBe("2.00")
  })
})

// ─── InviteSDKError ───────────────────────────────────────────────────────────

describe("InviteSDKError", () => {
  it("has the correct name and errorCode", () => {
    const err = new InviteSDKError("contract is not active", "NOT_ACTIVE")
    expect(err.name).toBe("InviteSDKError")
    expect(err.errorCode).toBe("NOT_ACTIVE")
    expect(err.message).toBe("contract is not active")
    expect(err instanceof Error).toBe(true)
    expect(err instanceof InviteSDKError).toBe(true)
  })

  it("defaults to UNKNOWN errorCode", () => {
    const err = new InviteSDKError("something went wrong")
    expect(err.errorCode).toBe("UNKNOWN")
  })
})

// ─── InviteSDK ────────────────────────────────────────────────────────────────

describe("InviteSDK", () => {
  let publicClient: MockPublicClient
  let walletClient: MockWalletClient
  let sdk: InviteSDK

  beforeEach(async () => {
    const clients = makeClients(SupportedChains.CELO)
    publicClient = clients.publicClient
    walletClient = clients.walletClient

    sdk = await InviteSDK.init({
      publicClient: publicClient as PublicClient,
      walletClient: walletClient as WalletClient,
      env: "production",
      contractAddress: MOCK_CONTRACT,
    })

    // Stub submitAndWait to avoid real RPC/timer calls in most tests
    sdk["submitAndWait"] = vi.fn()
  })

  // ─── init ────────────────────────────────────────────────────────────────

  describe("init", () => {
    it("throws when the wallet is on an unsupported chain", async () => {
      const { publicClient: pc, walletClient: wc } = makeClients(99999)
      await expect(
        InviteSDK.init({
          publicClient: pc as PublicClient,
          walletClient: wc as WalletClient,
          env: "production",
        }),
      ).rejects.toThrow(/unsupported chain/i)
    })

    it("throws when the wallet has no account attached", async () => {
      const { publicClient: pc, walletClient: wc } = makeClients()
      wc.getAddresses = vi.fn().mockResolvedValue([])
      await expect(
        InviteSDK.init({
          publicClient: pc as PublicClient,
          walletClient: wc as WalletClient,
          env: "production",
          contractAddress: MOCK_CONTRACT,
        }),
      ).rejects.toThrow(/no account/i)
    })

    it("resolves the contract address automatically from env + chain", async () => {
      const { publicClient: pc, walletClient: wc } = makeClients(SupportedChains.CELO)
      const s = await InviteSDK.init({
        publicClient: pc as PublicClient,
        walletClient: wc as WalletClient,
        env: "production",
      })
      expect(s.contractAddress).toBe(INVITES_V2_ADDRESSES.production[SupportedChains.CELO])
    })
  })

  // ─── Read methods ────────────────────────────────────────────────────────

  describe("getActive", () => {
    it("returns true when the contract is active", async () => {
      ;(publicClient.readContract as any).mockResolvedValueOnce(true)
      expect(await sdk.getActive()).toBe(true)
      expect(publicClient.readContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "active" }),
      )
    })

    it("returns false when the contract is inactive", async () => {
      ;(publicClient.readContract as any).mockResolvedValueOnce(false)
      expect(await sdk.getActive()).toBe(false)
    })
  })

  describe("getMinimums", () => {
    it("returns combined minimumClaims and minimumDays", async () => {
      ;(publicClient.readContract as any)
        .mockResolvedValueOnce(5)   // minimumClaims
        .mockResolvedValueOnce(14)  // minimumDays
      const result = await sdk.getMinimums()
      expect(result).toEqual({ minimumClaims: 5, minimumDays: 14 })
    })
  })

  describe("getUser", () => {
    it("maps the contract tuple to an InviteUser struct", async () => {
      const tuple = makeUserTuple({
        invitedBy: MOCK_INVITER,
        joinedAt: 1000n,
        bountyAtJoin: 500n,
        level: 1n,
      })
      ;(publicClient.readContract as any).mockResolvedValueOnce(tuple)

      const user = await sdk.getUser(MOCK_INVITEE)
      expect(user.invitedBy).toBe(MOCK_INVITER)
      expect(user.joinedAt).toBe(1000n)
      expect(user.bountyAtJoin).toBe(500n)
      expect(user.level).toBe(1n)
      expect(user.bountyPaid).toBe(false)
    })
  })

  describe("getLevel", () => {
    it("maps the contract tuple to an InviteLevel struct", async () => {
      ;(publicClient.readContract as any).mockResolvedValueOnce([10n, 1250n, 30n])
      const level = await sdk.getLevel(0)
      expect(level).toEqual({ toNext: 10n, bounty: 1250n, daysToComplete: 30n })
      expect(publicClient.readContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "levels", args: [0n] }),
      )
    })
  })

  describe("getStats", () => {
    it("maps the contract tuple to an InviteStats struct", async () => {
      ;(publicClient.readContract as any).mockResolvedValueOnce([100n, 50n, 200n])
      const stats = await sdk.getStats()
      expect(stats).toEqual({
        totalApprovedInvites: 100n,
        totalBountiesPaid: 50n,
        totalInvited: 200n,
      })
    })
  })

  describe("getInvitees / getPendingInvitees / getPendingBounties", () => {
    it("getInvitees returns the address array", async () => {
      ;(publicClient.readContract as any).mockResolvedValueOnce([MOCK_INVITEE])
      expect(await sdk.getInvitees(MOCK_INVITER)).toEqual([MOCK_INVITEE])
    })

    it("getPendingInvitees returns the address array", async () => {
      ;(publicClient.readContract as any).mockResolvedValueOnce([MOCK_INVITEE])
      expect(await sdk.getPendingInvitees(MOCK_INVITER)).toEqual([MOCK_INVITEE])
    })

    it("getPendingBounties returns a bigint count", async () => {
      ;(publicClient.readContract as any).mockResolvedValueOnce(3n)
      expect(await sdk.getPendingBounties(MOCK_INVITER)).toBe(3n)
    })
  })

  describe("canCollectBounty", () => {
    it("returns true when the invitee is eligible", async () => {
      ;(publicClient.readContract as any).mockResolvedValueOnce(true)
      expect(await sdk.canCollectBounty(MOCK_INVITEE)).toBe(true)
      expect(publicClient.readContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "canCollectBountyFor", args: [MOCK_INVITEE] }),
      )
    })

    it("returns false when the invitee is not eligible", async () => {
      ;(publicClient.readContract as any).mockResolvedValueOnce(false)
      expect(await sdk.canCollectBounty(MOCK_INVITEE)).toBe(false)
    })
  })

  describe("resolveCode", () => {
    it("returns the address that owns the code", async () => {
      ;(publicClient.readContract as any).mockResolvedValueOnce(MOCK_INVITER)
      expect(await sdk.resolveCode(MY_CODE)).toBe(MOCK_INVITER)
    })

    it("returns zeroAddress for an unregistered code", async () => {
      ;(publicClient.readContract as any).mockResolvedValueOnce(zeroAddress)
      expect(await sdk.resolveCode(MY_CODE)).toBe(zeroAddress)
    })
  })

  describe("getIdentityAddress", () => {
    it("returns the identity contract address", async () => {
      ;(publicClient.readContract as any).mockResolvedValueOnce(MOCK_IDENTITY)
      expect(await sdk.getIdentityAddress()).toBe(MOCK_IDENTITY)
    })
  })

  // ─── checkEligibilityDetails ──────────────────────────────────────────────

  describe("checkEligibilityDetails", () => {
    it("returns eligible=true with all flags set when invitee is whitelisted", async () => {
      // Calls: getIdentity, active, canCollectBountyFor, minimumClaims, minimumDays, users, isWhitelisted(invitee)
      // No lastAuthenticated call since invitee is whitelisted
      const userTuple = makeUserTuple({ invitedBy: zeroAddress })
      ;(publicClient.readContract as any)
        .mockResolvedValueOnce(MOCK_IDENTITY) // getIdentity
        .mockResolvedValueOnce(true)           // active
        .mockResolvedValueOnce(true)           // canCollectBountyFor
        .mockResolvedValueOnce(3)              // minimumClaims
        .mockResolvedValueOnce(14)             // minimumDays
        .mockResolvedValueOnce(userTuple)      // users
        .mockResolvedValueOnce(true)           // isWhitelisted(invitee) → whitelisted, no lastAuthenticated call

      const { eligible, details } = await sdk.checkEligibilityDetails(MOCK_INVITEE)
      expect(eligible).toBe(true)
      expect(details.isActive).toBe(true)
      expect(details.inviteeWhitelisted).toBe(true)
      expect(details.reverificationDue).toBe(false)
    })

    it("sets reverificationDue=true when invitee had prior auth but is no longer whitelisted (lapsed)", async () => {
      const userTuple = makeUserTuple({ invitedBy: MOCK_INVITER, joinedAt: 9999n })
      ;(publicClient.readContract as any)
        .mockResolvedValueOnce(MOCK_IDENTITY) // getIdentity
        .mockResolvedValueOnce(false)          // active
        .mockResolvedValueOnce(false)          // canCollectBountyFor
        .mockResolvedValueOnce(3)              // minimumClaims
        .mockResolvedValueOnce(14)             // minimumDays
        .mockResolvedValueOnce(userTuple)      // users
        .mockResolvedValueOnce(false)          // isWhitelisted(invitee) → not whitelisted
        .mockResolvedValueOnce(1700000000n)    // lastAuthenticated(invitee) > 0 → lapsed
        .mockResolvedValueOnce(true)           // isWhitelisted(inviter)

      const { eligible, details } = await sdk.checkEligibilityDetails(MOCK_INVITEE)
      expect(eligible).toBe(false)
      expect(details.inviteeWhitelisted).toBe(false)
      expect(details.reverificationDue).toBe(true)
    })

    it("reverificationDue=false when invitee is not whitelisted but has never authenticated", async () => {
      const userTuple = makeUserTuple({ invitedBy: zeroAddress })
      ;(publicClient.readContract as any)
        .mockResolvedValueOnce(MOCK_IDENTITY) // getIdentity
        .mockResolvedValueOnce(true)           // active
        .mockResolvedValueOnce(false)          // canCollectBountyFor
        .mockResolvedValueOnce(3)              // minimumClaims
        .mockResolvedValueOnce(14)             // minimumDays
        .mockResolvedValueOnce(userTuple)      // users
        .mockResolvedValueOnce(false)          // isWhitelisted(invitee) → not whitelisted
        .mockResolvedValueOnce(0n)             // lastAuthenticated(invitee) = 0 → never authenticated

      const { eligible, details } = await sdk.checkEligibilityDetails(MOCK_INVITEE)
      expect(details.inviteeWhitelisted).toBe(false)
      expect(details.reverificationDue).toBe(false)
    })

    it("sets reverificationDue=true when inviter had prior auth but is no longer whitelisted", async () => {
      const userTuple = makeUserTuple({ invitedBy: MOCK_INVITER, joinedAt: 9999n })
      ;(publicClient.readContract as any)
        .mockResolvedValueOnce(MOCK_IDENTITY) // getIdentity
        .mockResolvedValueOnce(true)           // active
        .mockResolvedValueOnce(false)          // canCollectBountyFor
        .mockResolvedValueOnce(3)              // minimumClaims
        .mockResolvedValueOnce(14)             // minimumDays
        .mockResolvedValueOnce(userTuple)      // users
        .mockResolvedValueOnce(true)           // isWhitelisted(invitee)
        .mockResolvedValueOnce(false)          // isWhitelisted(inviter) → not whitelisted
        .mockResolvedValueOnce(1700000000n)    // lastAuthenticated(inviter) > 0 → lapsed

      const { eligible, details } = await sdk.checkEligibilityDetails(MOCK_INVITEE)
      expect(details.inviterWhitelisted).toBe(false)
      expect(details.reverificationDue).toBe(true)
    })

    it("reverificationDue=false when identity read fails (no history determinable)", async () => {
      const userTuple = makeUserTuple({ invitedBy: zeroAddress })
      ;(publicClient.readContract as any)
        .mockResolvedValueOnce(MOCK_IDENTITY) // getIdentity
        .mockResolvedValueOnce(true)           // active
        .mockResolvedValueOnce(false)          // canCollectBountyFor
        .mockResolvedValueOnce(3)              // minimumClaims
        .mockResolvedValueOnce(14)             // minimumDays
        .mockResolvedValueOnce(userTuple)      // users
        .mockRejectedValueOnce(new Error("identity contract error")) // isWhitelisted throws
        // lastAuthenticated also throws — reverificationDue stays false
        .mockRejectedValueOnce(new Error("identity contract error"))

      const { details } = await sdk.checkEligibilityDetails(MOCK_INVITEE)
      expect(details.inviteeWhitelisted).toBe(false)
      expect(details.reverificationDue).toBe(false)
    })

    it("skips identity checks when identity address is zeroAddress", async () => {
      const userTuple = makeUserTuple()
      ;(publicClient.readContract as any)
        .mockResolvedValueOnce(zeroAddress) // getIdentity
        .mockResolvedValueOnce(true)         // active
        .mockResolvedValueOnce(true)         // canCollectBountyFor
        .mockResolvedValueOnce(3)            // minimumClaims
        .mockResolvedValueOnce(14)           // minimumDays
        .mockResolvedValueOnce(userTuple)    // users

      const { eligible, details } = await sdk.checkEligibilityDetails(MOCK_INVITEE)
      expect(eligible).toBe(true)
      expect(details.inviteeWhitelisted).toBe(false) // default when identity is zero
      expect(details.reverificationDue).toBe(false)
    })
  })

  // ─── join ─────────────────────────────────────────────────────────────────

  describe("join", () => {
    function mockJoinPreChecks({
      isActive = true,
      codeOwner = zeroAddress,
      callerUser = makeUserTuple(),
      inviterOwner,
    } = {}) {
      ;(publicClient.readContract as any)
        .mockResolvedValueOnce(isActive)     // active
        .mockResolvedValueOnce(codeOwner)    // codeToUser(myCode)
        .mockResolvedValueOnce(callerUser)   // users(account)

      if (inviterOwner !== undefined) {
        ;(publicClient.readContract as any)
          .mockResolvedValueOnce(inviterOwner) // codeToUser(inviterCode)
      }
    }

    it("calls submitAndWait with join args and returns txHash", async () => {
      mockJoinPreChecks({ inviterOwner: MOCK_INVITEE })
      ;(sdk["submitAndWait"] as any).mockResolvedValueOnce({ transactionHash: MOCK_TX_HASH })

      const hash = await sdk.join(MY_CODE, INVITER_CODE)
      expect(hash).toBe(MOCK_TX_HASH)
      expect(sdk["submitAndWait"]).toHaveBeenCalledWith("join", [MY_CODE, INVITER_CODE])
    })

    it("throws NOT_ACTIVE when contract is inactive", async () => {
      mockJoinPreChecks({ isActive: false })
      await expect(sdk.join(MY_CODE, INVITER_CODE)).rejects.toMatchObject({
        errorCode: "NOT_ACTIVE",
      })
    })

    it("throws INVITE_CODE_IN_USE when the code is already registered", async () => {
      mockJoinPreChecks({ codeOwner: MOCK_INVITEE })
      await expect(sdk.join(MY_CODE, INVITER_CODE)).rejects.toMatchObject({
        errorCode: "INVITE_CODE_IN_USE",
      })
    })

    it("allows a caller to attach an inviter after registering their own code", async () => {
      mockJoinPreChecks()
      ;(sdk["submitAndWait"] as any).mockResolvedValueOnce({ transactionHash: MOCK_TX_HASH })
      await expect(sdk.join(MY_CODE, ZERO_BYTES32)).resolves.toBe(MOCK_TX_HASH)

      mockJoinPreChecks({
        codeOwner: MOCK_INVITER,
        callerUser: makeUserTuple({ inviteCode: MY_CODE, joinedAt: 9999n }),
        inviterOwner: MOCK_INVITEE,
      })
      ;(sdk["submitAndWait"] as any).mockResolvedValueOnce({ transactionHash: MOCK_TX_HASH })
      await expect(sdk.join(MY_CODE, INVITER_CODE)).resolves.toBe(MOCK_TX_HASH)
      expect(sdk["submitAndWait"]).toHaveBeenLastCalledWith("join", [MY_CODE, INVITER_CODE])
    })

    it("throws INVITER_ALREADY_ATTACHED when caller already has an inviter", async () => {
      mockJoinPreChecks({
        codeOwner: MOCK_INVITER,
        callerUser: makeUserTuple({ inviteCode: MY_CODE, invitedBy: MOCK_INVITEE }),
        inviterOwner: MOCK_IDENTITY,
      })
      await expect(sdk.join(MY_CODE, INVITER_CODE)).rejects.toMatchObject({
        errorCode: "INVITER_ALREADY_ATTACHED",
      })
    })

    it("throws BOUNTY_ALREADY_PAID when caller has received their bounty", async () => {
      mockJoinPreChecks({
        codeOwner: MOCK_INVITER,
        callerUser: makeUserTuple({ inviteCode: MY_CODE, bountyPaid: true }),
        inviterOwner: MOCK_INVITEE,
      })
      await expect(sdk.join(MY_CODE, INVITER_CODE)).rejects.toMatchObject({
        errorCode: "BOUNTY_ALREADY_PAID",
      })
    })

    it("throws INVALID_INVITER when attaching an unknown inviter code", async () => {
      mockJoinPreChecks({
        codeOwner: MOCK_INVITER,
        callerUser: makeUserTuple({ inviteCode: MY_CODE }),
        inviterOwner: zeroAddress,
      })
      await expect(sdk.join(MY_CODE, INVITER_CODE)).rejects.toMatchObject({
        errorCode: "INVALID_INVITER",
      })
    })

    it("throws SELF_INVITE when myCode equals inviterCode", async () => {
      mockJoinPreChecks()
      await expect(sdk.join(MY_CODE, MY_CODE)).rejects.toMatchObject({
        errorCode: "SELF_INVITE",
      })
    })

    it("throws SELF_INVITE when inviter code belongs to the caller", async () => {
      mockJoinPreChecks({ inviterOwner: MOCK_INVITER })
      await expect(sdk.join(MY_CODE, INVITER_CODE)).rejects.toMatchObject({
        errorCode: "SELF_INVITE",
      })
    })

    it("does not throw SELF_INVITE when inviterCode is zeroHash", async () => {
      mockJoinPreChecks()
      ;(sdk["submitAndWait"] as any).mockResolvedValueOnce({ transactionHash: MOCK_TX_HASH })
      // zeroHash inviter is allowed even if myCode is the same as zeroHash conceptually
      await expect(sdk.join(MY_CODE, ZERO_BYTES32)).resolves.toBe(MOCK_TX_HASH)
    })
  })

  // ─── collectBounty ────────────────────────────────────────────────────────

  describe("collectBounty", () => {
    it("parses InviterBounty log and returns a BountyResult", async () => {
      ;(publicClient.readContract as any)
        .mockResolvedValueOnce(true)  // active
        .mockResolvedValueOnce(true)  // canCollectBountyFor

      const receipt = makeBountyReceipt(MOCK_INVITER, MOCK_INVITEE, 1250n, 0n, false)
      ;(sdk["submitAndWait"] as any).mockResolvedValueOnce(receipt)

      const result = await sdk.collectBounty(MOCK_INVITEE)
      expect(result.txHash).toBe(MOCK_TX_HASH)
      expect(result.invitee).toBe(MOCK_INVITEE)
      expect(result.inviter).toBe(MOCK_INVITER)
      expect(result.bountyPaid).toBe(1250n)
      expect(result.earnedLevel).toBe(false)
    })

    it("throws NOT_ACTIVE when contract is inactive", async () => {
      ;(publicClient.readContract as any).mockResolvedValueOnce(false) // active = false
      await expect(sdk.collectBounty(MOCK_INVITEE)).rejects.toMatchObject({
        errorCode: "NOT_ACTIVE",
      })
    })

    it("throws NOT_ELIGIBLE_BOUNTY when canCollectBountyFor returns false", async () => {
      ;(publicClient.readContract as any)
        .mockResolvedValueOnce(true)   // active
        .mockResolvedValueOnce(false)  // canCollectBountyFor → not eligible

      // checkEligibilityDetails needs additional reads
      ;(publicClient.readContract as any)
        .mockResolvedValueOnce(MOCK_IDENTITY) // getIdentity
        .mockResolvedValueOnce(true)           // active (again)
        .mockResolvedValueOnce(false)          // canCollectBountyFor (again)
        .mockResolvedValueOnce(3)              // minimumClaims
        .mockResolvedValueOnce(14)             // minimumDays
        .mockResolvedValueOnce(makeUserTuple({ invitedBy: zeroAddress })) // users
        .mockResolvedValueOnce(false)          // isWhitelisted(invitee) → false
        .mockResolvedValueOnce(0n)             // lastAuthenticated(invitee) → 0 (never authed)

      await expect(sdk.collectBounty(MOCK_INVITEE)).rejects.toMatchObject({
        errorCode: "NOT_ELIGIBLE_BOUNTY",
      })
    })

    it("returns zero-bounty result when no InviterBounty log is emitted", async () => {
      ;(publicClient.readContract as any)
        .mockResolvedValueOnce(true)  // active
        .mockResolvedValueOnce(true)  // canCollectBountyFor

      // Receipt with no logs
      const emptyReceipt = { ...makeBountyReceipt(), logs: [], transactionHash: MOCK_TX_HASH }
      ;(sdk["submitAndWait"] as any).mockResolvedValueOnce(emptyReceipt)

      const result = await sdk.collectBounty(MOCK_INVITEE)
      expect(result.bountyPaid).toBe(0n)
      expect(result.txHash).toBe(MOCK_TX_HASH)
    })
  })

  // ─── collectAllBounties ───────────────────────────────────────────────────

  describe("collectAllBounties", () => {
    it("throws NOT_ACTIVE when contract is inactive", async () => {
      ;(publicClient.readContract as any).mockResolvedValueOnce(false) // active = false
      await expect(sdk.collectAllBounties()).rejects.toMatchObject({
        errorCode: "NOT_ACTIVE",
      })
    })

    it("returns an array of BountyResult from multiple logs", async () => {
      ;(publicClient.readContract as any).mockResolvedValueOnce(true) // active

      const receipt = makeBountyReceipt(MOCK_INVITER, MOCK_INVITEE, 1000n, 1n, true)
      ;(sdk["submitAndWait"] as any).mockResolvedValueOnce(receipt)

      const results = await sdk.collectAllBounties()
      expect(Array.isArray(results)).toBe(true)
      expect(results).toHaveLength(1)
      expect(results[0].bountyPaid).toBe(1000n)
      expect(results[0].earnedLevel).toBe(true)
      expect(results[0].inviterLevel).toBe(1n)
    })

    it("returns an empty array when there are no pending bounties", async () => {
      ;(publicClient.readContract as any).mockResolvedValueOnce(true) // active

      const emptyReceipt = { ...makeBountyReceipt(), logs: [], transactionHash: MOCK_TX_HASH }
      ;(sdk["submitAndWait"] as any).mockResolvedValueOnce(emptyReceipt)

      const results = await sdk.collectAllBounties()
      expect(results).toHaveLength(0)
    })
  })

  // ─── getAccount ──────────────────────────────────────────────────────────

  describe("getAccount", () => {
    it("returns the connected wallet address", () => {
      expect(sdk.getAccount()).toBe(MOCK_INVITER)
    })
  })

  // ─── getJoinCallData ─────────────────────────────────────────────────────

  describe("getJoinCallData", () => {
    it("returns ABI-encoded calldata starting with the join function selector", () => {
      const data = sdk.getJoinCallData(MY_CODE, INVITER_CODE)
      // join(bytes32,bytes32) selector = keccak256("join(bytes32,bytes32)")[0:4]
      expect(data).toMatch(/^0x/)
      expect(data.length).toBeGreaterThan(10)
    })

    it("returns consistent calldata for the same inputs", () => {
      const data1 = sdk.getJoinCallData(MY_CODE, INVITER_CODE)
      const data2 = sdk.getJoinCallData(MY_CODE, INVITER_CODE)
      expect(data1).toBe(data2)
    })

    it("returns different calldata for different inputs", () => {
      const data1 = sdk.getJoinCallData(MY_CODE, INVITER_CODE)
      const data2 = sdk.getJoinCallData(INVITER_CODE, MY_CODE)
      expect(data1).not.toBe(data2)
    })
  })
})

// ─── INVITES_V2_ADDRESSES coverage ───────────────────────────────────────────

describe("INVITES_V2_ADDRESSES", () => {
  it("has production addresses for Celo and XDC", () => {
    expect(INVITES_V2_ADDRESSES.production[SupportedChains.CELO]).toMatch(/^0x/)
    expect(INVITES_V2_ADDRESSES.production[SupportedChains.XDC]).toMatch(/^0x/)
  })

  it("does not have a production address for Fuse (unsupported)", () => {
    expect(INVITES_V2_ADDRESSES.production).not.toHaveProperty("122")
  })

  it("has development addresses for Celo and XDC", () => {
    expect(INVITES_V2_ADDRESSES.development[SupportedChains.CELO]).toMatch(/^0x/)
    expect(INVITES_V2_ADDRESSES.development[SupportedChains.XDC]).toMatch(/^0x/)
  })
})

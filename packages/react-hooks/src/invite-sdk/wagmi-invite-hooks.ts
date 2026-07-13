import { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { usePublicClient, useWalletClient, useAccount } from "wagmi"
import { type Address, type PublicClient } from "viem"
import {
  InviteSDK,
  type contractEnv,
  type BountyResult,
  type InviteUser,
  type InviteLevel,
  InviteSDKError,
} from "@goodsdks/invite-sdk"

// ─── Query key factory ────────────────────────────────────────────────────────

const inviteStatusKey = (
  target: Address | undefined,
  env: contractEnv,
  contractAddress: Address | undefined,
) => ["invite-status", target, env, contractAddress] as const

// ─── useInviteSDK ─────────────────────────────────────────────────────────────

/**
 * Initialises and returns an `InviteSDK` instance tied to the connected wallet.
 *
 * When the wallet or public client is not yet available the hook returns
 * `{ sdk: null, loading: false, error: null }` — a neutral/disconnected state
 * with no error set.
 */
export const useInviteSDK = (
  env: contractEnv = "production",
): {
  sdk: InviteSDK | null
  loading: boolean
  error: string | null
} => {
  const publicClient = usePublicClient() as PublicClient | undefined
  const { data: walletClient } = useWalletClient()

  const [sdk, setSdk] = useState<InviteSDK | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!publicClient || !walletClient) {
      // Neutral/disconnected state — no error
      setSdk(null)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    InviteSDK.init({ publicClient, walletClient, env })
      .then((instance) => {
        setSdk(instance)
      })
      .catch((err) => {
        setSdk(null)
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => setLoading(false))
  }, [publicClient, walletClient, env])

  return { sdk, loading, error }
}

// ─── useInviteStatus ─────────────────────────────────────────────────────────

export interface InviteStatusData {
  user: InviteUser
  eligible: boolean
  pendingBounties: bigint
  pendingInvitees: Address[]
  /** All invitees registered under this address (including pending ones). */
  invitees: Address[]
  /** The bounty-level configuration for the user's current inviter level. */
  bountyLevel: InviteLevel | null
  /** Global minimum-claims threshold for bounty eligibility. */
  minimumClaims: number
  /** Global minimum-days threshold for bounty eligibility. */
  minimumDays: number
  /** True when reverification is due (whitelist check fails despite past identity). */
  reverificationDue: boolean
}

/**
 * Reads the invite status for the connected wallet (or a given `invitee` address)
 * using React Query for caching and automatic invalidation.
 *
 * Returns the standard React Query result object (`data`, `isLoading`, `error`, `refetch`).
 * All result fields are nested under `data` when available.
 */
export const useInviteStatus = (
  invitee?: Address,
  env: contractEnv = "production",
) => {
  const { address: connectedAddress } = useAccount()
  const { sdk } = useInviteSDK(env)

  const target = invitee ?? connectedAddress

  return useQuery<InviteStatusData | null>({
    queryKey: inviteStatusKey(target, env, sdk?.contractAddress),
    queryFn: async () => {
      if (!sdk || !target) return null

      const [user, eligibilityResult, pending, pendingInvs, allInvitees, minimums] =
        await Promise.all([
          sdk.getUser(target),
          sdk.checkEligibilityDetails(target),
          sdk.getPendingBounties(target),
          sdk.getPendingInvitees(target),
          sdk.getInvitees(target),
          sdk.getMinimums(),
        ])

      const bountyLevel = await sdk.getLevel(Number(user.level)).catch(() => null)

      return {
        user,
        eligible: eligibilityResult.eligible,
        reverificationDue: eligibilityResult.details.reverificationDue,
        pendingBounties: pending,
        pendingInvitees: pendingInvs,
        invitees: allInvitees,
        bountyLevel,
        minimumClaims: minimums.minimumClaims,
        minimumDays: minimums.minimumDays,
      }
    },
    enabled: !!sdk && !!target,
  })
}

// ─── useJoin ─────────────────────────────────────────────────────────────────

/**
 * Returns a `useMutation` for `join(myCode, inviterCode)`.
 *
 * Pre-checks (contract must be active, code must be free, user must not have
 * joined) are run inside the SDK before simulation to surface errors before
 * signing. On success, the invite-status query is invalidated automatically.
 */
export const useJoin = (env: contractEnv = "production") => {
  const { sdk } = useInviteSDK(env)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      myCode,
      inviterCode,
    }: {
      myCode: `0x${string}`
      inviterCode: `0x${string}`
    }) => {
      if (!sdk) throw new Error("InviteSDK not initialized")
      return sdk.join(myCode, inviterCode)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invite-status"] })
    },
    onError: (err) => {
      if (err instanceof InviteSDKError) {
        // Re-throw with errorCode included in message for downstream consumers
        throw new InviteSDKError(
          `[${err.errorCode}] ${err.message}`,
          err.errorCode,
        )
      }
    },
  })
}

// ─── useCollectBounty ────────────────────────────────────────────────────────

/**
 * Returns a `useMutation` for `collectBounty(invitee)`.
 *
 * Pre-checks that the contract is active and `canCollectBountyFor(invitee)` is
 * true. On success, the invite-status query is invalidated automatically.
 */
export const useCollectBounty = (env: contractEnv = "production") => {
  const { sdk } = useInviteSDK(env)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (invitee: Address): Promise<BountyResult> => {
      if (!sdk) throw new Error("InviteSDK not initialized")
      return sdk.collectBounty(invitee)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invite-status"] })
    },
  })
}

// ─── useCollectAllBounties ───────────────────────────────────────────────────

/**
 * Returns a `useMutation` for `collectAllBounties()`.
 *
 * Batches all pending invitee payouts for the caller in a single transaction.
 * Pre-checks that the contract is active. On success, the invite-status query
 * is invalidated automatically.
 */
export const useCollectAllBounties = (env: contractEnv = "production") => {
  const { sdk } = useInviteSDK(env)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<BountyResult[]> => {
      if (!sdk) throw new Error("InviteSDK not initialized")
      return sdk.collectAllBounties()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invite-status"] })
    },
  })
}

// Re-export error class so callers can branch on err.errorCode
export { InviteSDKError }

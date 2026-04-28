import { useState, useEffect, useCallback } from "react"
import { usePublicClient, useWalletClient, useAccount } from "wagmi"
import { type Address, type PublicClient } from "viem"
import {
  InviteSDK,
  type contractEnv,
  type BountyResult,
  type InviteUser,
  InviteSDKError,
} from "@goodsdks/invite-sdk"

// ─── useInviteSDK ─────────────────────────────────────────────────────────────

/**
 * Initialises and returns an `InviteSDK` instance tied to the connected wallet.
 */
export const useInviteSDK = (
  env: contractEnv = "production",
): {
  sdk: InviteSDK | null
  loading: boolean
  error: string | null
} => {
  const publicClient = usePublicClient() as PublicClient
  const { data: walletClient } = useWalletClient()

  const [sdk, setSdk] = useState<InviteSDK | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!publicClient || !walletClient) {
      setSdk(null)
      setError("Wallet or Public client not initialized")
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

export interface InviteStatus {
  user: InviteUser | null
  eligible: boolean
  pendingBounties: bigint
  pendingInvitees: Address[]
  /** True when reverification is due (whitelist check fails despite past identity). */
  reverificationDue: boolean
  loading: boolean
  error: string | null
  /** Re-fetch all data. */
  refetch: () => void
}

/**
 * Reads the invite status for the connected wallet (or a given `invitee` address).
 *
 * Returns:
 * - The user's `InviteUser` record
 * - Whether they are currently eligible for a bounty
 * - Pending bounty count and invitee list
 * - A `reverificationDue` flag when the whitelist check has lapsed
 */
export const useInviteStatus = (invitee?: Address): InviteStatus => {
  const { address: connectedAddress } = useAccount()
  const { sdk, loading: sdkLoading, error: sdkError } = useInviteSDK()

  const target = invitee ?? connectedAddress

  const [user, setUser] = useState<InviteUser | null>(null)
  const [eligible, setEligible] = useState(false)
  const [pendingBounties, setPendingBounties] = useState(0n)
  const [pendingInvitees, setPendingInvitees] = useState<Address[]>([])
  const [reverificationDue, setReverificationDue] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!sdk || !target) {
      setUser(null)
      return
    }

    setLoading(true)
    setError(null)

    Promise.all([
      sdk.getUser(target),
      sdk.checkEligibilityDetails(target),
      sdk.getPendingBounties(target),
      sdk.getPendingInvitees(target),
    ])
      .then(([u, eligibilityResult, pending, pendingInvs]) => {
        setUser(u)
        setEligible(eligibilityResult.eligible)
        setReverificationDue(eligibilityResult.details.reverificationDue)
        setPendingBounties(pending)
        setPendingInvitees(pendingInvs)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => setLoading(false))
  }, [sdk, target, tick])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  return {
    user,
    eligible,
    pendingBounties,
    pendingInvitees,
    reverificationDue,
    loading: sdkLoading || loading,
    error: sdkError ?? error,
    refetch,
  }
}

// ─── useJoin ─────────────────────────────────────────────────────────────────

export interface UseJoinResult {
  join: (myCode: `0x${string}`, inviterCode: `0x${string}`) => Promise<`0x${string}`>
  loading: boolean
  error: string | null
  txHash: `0x${string}` | null
}

/**
 * Returns a `join(myCode, inviterCode)` action together with its loading/error state.
 *
 * Pre-checks (contract must be active, code must be free, user must not have joined)
 * are run before simulation to surface errors before signing.
 */
export const useJoin = (env: contractEnv = "production"): UseJoinResult => {
  const { sdk } = useInviteSDK(env)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)

  const join = useCallback(
    async (myCode: `0x${string}`, inviterCode: `0x${string}`) => {
      if (!sdk) throw new Error("InviteSDK not initialized")

      setLoading(true)
      setError(null)
      setTxHash(null)

      try {
        const hash = await sdk.join(myCode, inviterCode)
        setTxHash(hash)
        return hash
      } catch (err) {
        const msg =
          err instanceof InviteSDKError
            ? `[${err.errorCode}] ${err.message}`
            : err instanceof Error
              ? err.message
              : String(err)
        setError(msg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [sdk],
  )

  return { join, loading, error, txHash }
}

// ─── useCollectBounty ────────────────────────────────────────────────────────

export interface UseCollectBountyResult {
  collectBounty: (invitee: Address) => Promise<BountyResult>
  loading: boolean
  error: string | null
  result: BountyResult | null
}

/**
 * Returns a `collectBounty(invitee)` action + tx state.
 *
 * Pre-checks that the contract is active and `canCollectBountyFor(invitee)` is true.
 * On failure the error includes the specific ineligibility reason.
 */
export const useCollectBounty = (
  env: contractEnv = "production",
): UseCollectBountyResult => {
  const { sdk } = useInviteSDK(env)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BountyResult | null>(null)

  const collectBounty = useCallback(
    async (invitee: Address) => {
      if (!sdk) throw new Error("InviteSDK not initialized")

      setLoading(true)
      setError(null)
      setResult(null)

      try {
        const bountyResult = await sdk.collectBounty(invitee)
        setResult(bountyResult)
        return bountyResult
      } catch (err) {
        const msg =
          err instanceof InviteSDKError
            ? `[${err.errorCode}] ${err.message}`
            : err instanceof Error
              ? err.message
              : String(err)
        setError(msg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [sdk],
  )

  return { collectBounty, loading, error, result }
}

// ─── useCollectAllBounties ───────────────────────────────────────────────────

export interface UseCollectAllBountiesResult {
  collectAllBounties: () => Promise<BountyResult[]>
  loading: boolean
  error: string | null
  results: BountyResult[]
}

/**
 * Returns a `collectAllBounties()` action + tx state.
 *
 * Batches all pending invitee payouts for the caller in a single transaction.
 * Pre-checks that the contract is active.
 */
export const useCollectAllBounties = (
  env: contractEnv = "production",
): UseCollectAllBountiesResult => {
  const { sdk } = useInviteSDK(env)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<BountyResult[]>([])

  const collectAllBounties = useCallback(async () => {
    if (!sdk) throw new Error("InviteSDK not initialized")

    setLoading(true)
    setError(null)
    setResults([])

    try {
      const bountyResults = await sdk.collectAllBounties()
      setResults(bountyResults)
      return bountyResults
    } catch (err) {
      const msg =
        err instanceof InviteSDKError
          ? `[${err.errorCode}] ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err)
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [sdk])

  return { collectAllBounties, loading, error, results }
}

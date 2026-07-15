import React, { useState } from "react"
import { YStack, Text, Spinner, XStack } from "tamagui"
import { useAccount } from "wagmi"
import {
  useInviteStatus,
  useJoin,
  useCollectAllBounties,
} from "@goodsdks/react-hooks"
import { SDK_ENV } from "../config"

/**
 * InviteSection — demonstrates the join + bounty flow using InviteSDK hooks.
 *
 * - Shows the connected user's invite status (eligibility, pending bounties, level).
 * - Provides a form to join with an invite code.
 * - Provides a button to collect all pending bounties.
 */
export const InviteSection: React.FC = () => {
  const { isConnected } = useAccount()
  const [joinCode, setJoinCode] = useState("")
  const [inviterCode, setInviterCode] = useState("")

  // ── invite status via React Query ──────────────────────────────────────────
  const {
    data: status,
    isLoading: statusLoading,
    error: statusError,
    refetch,
  } = useInviteStatus(undefined, SDK_ENV)

  // ── write mutations ─────────────────────────────────────────────────────────
  const {
    mutateAsync: join,
    isLoading: joining,
    error: joinError,
    data: joinTxHash,
  } = useJoin(SDK_ENV)

  const {
    mutateAsync: collectAll,
    isLoading: collecting,
    error: collectError,
    data: collectResults,
  } = useCollectAllBounties(SDK_ENV)

  // ── helpers ─────────────────────────────────────────────────────────────────
  const toBytes32 = (s: string): `0x${string}` => {
    const hex = Buffer.from(s, "utf8").toString("hex").padEnd(64, "0").slice(0, 64)
    return `0x${hex}` as `0x${string}`
  }

  const handleJoin = async () => {
    if (!joinCode) return
    try {
      await join({
        myCode: toBytes32(joinCode),
        inviterCode: inviterCode ? toBytes32(inviterCode) : ("0x" + "00".repeat(32) as `0x${string}`),
      })
      refetch()
    } catch {
      // error shown via joinError
    }
  }

  const handleCollectAll = async () => {
    try {
      await collectAll()
      refetch()
    } catch {
      // error shown via collectError
    }
  }

  if (!isConnected) return null

  return (
    <YStack
      padding="$4"
      backgroundColor="white"
      borderRadius="$4"
      borderWidth={1}
      borderColor="#E2E8F0"
      width="100%"
      maxWidth={600}
      alignItems="stretch"
      gap={12}
      marginTop={24}
      shadow="$1"
    >
      <Text fontSize={18} fontWeight="bold" color="$text" textAlign="center">
        Invite Flow Demo
      </Text>

      <Text fontSize={12} color="$gray9" textAlign="center">
        Demonstrates InviteSDK join + bounty collection. Uses the {SDK_ENV} environment.
      </Text>

      {/* ── Status ─────────────────────────────────────────────────────────── */}
      {statusLoading && <Spinner size="small" />}

      {statusError && (
        <Text fontSize={13} color="$red10">
          Status error: {statusError instanceof Error ? statusError.message : String(statusError)}
        </Text>
      )}

      {status && (
        <YStack gap={4} padding="$2" backgroundColor="#F7FAFC" borderRadius="$3">
          <Text fontSize={13} fontWeight="bold">Invite Status</Text>
          <Text fontSize={12} color="$gray11">
            Level: {status.user.level.toString()} | Joined:{" "}
            {status.user.joinedAt > 0n ? "Yes" : "No"}
          </Text>
          <Text fontSize={12} color="$gray11">
            Eligible for bounty: {status.eligible ? "✅ Yes" : "❌ No"}
          </Text>
          {status.reverificationDue && (
            <Text fontSize={12} color="$orange10">
              ⚠️ Reverification required — identity auth has lapsed.
            </Text>
          )}
          <Text fontSize={12} color="$gray11">
            Pending bounties: {status.pendingBounties.toString()} | Pending invitees:{" "}
            {status.pendingInvitees.length}
          </Text>
          <Text fontSize={12} color="$gray11">
            Total invitees: {status.invitees.length} | Min claims:{" "}
            {status.minimumClaims} | Min days: {status.minimumDays}
          </Text>
        </YStack>
      )}

      {/* ── Join ───────────────────────────────────────────────────────────── */}
      <YStack gap={8}>
        <Text fontSize={14} fontWeight="bold">Join with Invite Code</Text>
        <input
          placeholder="Your invite code (string)"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          style={{
            padding: "8px",
            borderRadius: "6px",
            border: "1px solid #CBD5E0",
            fontSize: "13px",
            width: "100%",
            boxSizing: "border-box",
          }}
        />
        <input
          placeholder="Inviter's code (optional)"
          value={inviterCode}
          onChange={(e) => setInviterCode(e.target.value)}
          style={{
            padding: "8px",
            borderRadius: "6px",
            border: "1px solid #CBD5E0",
            fontSize: "13px",
            width: "100%",
            boxSizing: "border-box",
          }}
        />
        <button
          onClick={handleJoin}
          disabled={!joinCode || joining}
          style={{
            padding: "8px 16px",
            backgroundColor: "#005AFF",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: joining || !joinCode ? "not-allowed" : "pointer",
            opacity: joining || !joinCode ? 0.6 : 1,
            fontSize: "14px",
          }}
        >
          {joining ? "Joining…" : "Join"}
        </button>
        {joinTxHash && (
          <Text fontSize={12} color="$green10">
            ✅ Joined! tx: {joinTxHash.slice(0, 12)}…
          </Text>
        )}
        {joinError && (
          <Text fontSize={12} color="$red10">
            {joinError instanceof Error ? joinError.message : String(joinError)}
          </Text>
        )}
      </YStack>

      {/* ── Collect All Bounties ──────────────────────────────────────────── */}
      <YStack gap={8}>
        <Text fontSize={14} fontWeight="bold">Collect All Pending Bounties</Text>
        <button
          onClick={handleCollectAll}
          disabled={collecting || (status?.pendingBounties ?? 0n) === 0n}
          style={{
            padding: "8px 16px",
            backgroundColor: "#38A169",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: collecting || (status?.pendingBounties ?? 0n) === 0n ? "not-allowed" : "pointer",
            opacity: collecting || (status?.pendingBounties ?? 0n) === 0n ? 0.6 : 1,
            fontSize: "14px",
          }}
        >
          {collecting
            ? "Collecting…"
            : `Collect (${status?.pendingBounties?.toString() ?? "0"} pending)`}
        </button>
        {collectResults && collectResults.length > 0 && (
          <Text fontSize={12} color="$green10">
            ✅ Collected {collectResults.length} bounty(ies)!
          </Text>
        )}
        {collectError && (
          <Text fontSize={12} color="$red10">
            {collectError instanceof Error ? collectError.message : String(collectError)}
          </Text>
        )}
      </YStack>
    </YStack>
  )
}

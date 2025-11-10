import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { CopyIcon, CheckIcon } from "lucide-react"
import { useEngagementRewards } from "@goodsdks/engagement-sdk"
import { useAccount } from "wagmi"
import { useIdentitySDK } from "@goodsdks/react-hooks"
import env from "@/env"

interface InviteReward {
  invitedWallet: string
  rewardAmount: string
}

const INVITE_STORAGE_KEY = "invite_inviter"

const formatAmount = (amount: bigint) => {
  return (Number(amount) / 1e18).toFixed(2)
}

const InviteDemo = () => {
  const { inviterAddress } = useParams()
  const { address: userWallet, isConnected } = useAccount()
  const { toast } = useToast()
  const { sdk: identitySDK } = useIdentitySDK()

  const [inviteLink, setInviteLink] = useState<string>("")
  const [isCopied, setIsCopied] = useState(false)
  const [inviteRewards, setInviteRewards] = useState<InviteReward[]>([])
  const [rewardAmount, setRewardAmount] = useState<bigint>(0n)
  const [inviterShare, setInviterShare] = useState<number>(0)
  const [isClaimable, setIsClaimable] = useState(false)
  const [isWhitelisted, setIsWhitelisted] = useState<boolean>(false)
  const [checkingWhitelist, setCheckingWhitelist] = useState<boolean>(true)

  const engagementRewards = useEngagementRewards(env.rewardsContract)

  // Handle inviter storage and reward details
  useEffect(() => {
    if (!engagementRewards || !userWallet) return
    console.log("fetching reward and events")
    const fetchRewardDetails = async () => {
      try {
        // Get reward amount and distribution percentages
        const [amount, [, , , , , userInviterPercentage, userPercentage]] =
          await Promise.all([
            engagementRewards.getRewardAmount(),
            engagementRewards.getAppInfo(env.demoApp),
          ])

        console.log(userInviterPercentage, userPercentage)
        if (amount) {
          setRewardAmount(amount)
        }

        // Calculate share percentages
        const totalUserInviter = Number(userInviterPercentage) || 0
        const userPercent = Number(userPercentage) || 0
        setInviterShare(
          Math.floor((totalUserInviter * (100 - userPercent)) / 100),
        )

        // Check if rewards can be claimed
        const canClaim = await engagementRewards.canClaim(
          env.demoApp,
          userWallet,
        )
        setIsClaimable(canClaim)

        // Get recent rewards
        const events = await engagementRewards.getAppRewardEvents(env.demoApp, {
          inviter: userWallet,
        })

        // Filter and map events where this wallet was the inviter
        const inviterEvents = events
          .filter(
            (event) =>
              event.inviter?.toLowerCase() === userWallet.toLowerCase(),
          )
          .map((event) => ({
            invitedWallet: event.user || "Unknown",
            rewardAmount: formatAmount(
              BigInt(event.inviterAmount || 0),
            ).toString(),
          }))

        setInviteRewards(inviterEvents)
      } catch (err) {
        console.error("Error fetching reward details:", err)
        toast({
          title: "Error",
          description: "Failed to load reward details",
          variant: "destructive",
        })
      }
    }

    fetchRewardDetails()
  }, [engagementRewards, userWallet, toast])

  // Handle invite link and inviter storage
  useEffect(() => {
    // Store inviter if in URL params
    if (inviterAddress) {
      localStorage.setItem(INVITE_STORAGE_KEY, inviterAddress)
    }

    // Update invite link when wallet is connected
    if (userWallet) {
      const baseUrl = window.location.origin
      setInviteLink(`${baseUrl}/invite/${userWallet}`)
    }
  }, [inviterAddress, userWallet])

  // Add whitelist check effect
  useEffect(() => {
    const checkWhitelistStatus = async () => {
      if (!identitySDK || !userWallet) {
        setCheckingWhitelist(false)
        return
      }

      try {
        const { isWhitelisted } =
          await identitySDK.getWhitelistedRoot(userWallet)
        setIsWhitelisted(isWhitelisted)
      } catch (error) {
        console.error("Error checking whitelist status:", error)
      } finally {
        setCheckingWhitelist(false)
      }
    }

    checkWhitelistStatus()
  }, [identitySDK, userWallet])

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setIsCopied(true)
      toast({
        title: "Success",
        description: "Invite link copied to clipboard!",
      })
      setTimeout(() => setIsCopied(false), 2000)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Could not copy invite link. Please try again.",
        variant: "destructive",
      })
    }
  }

  const claimReward = async () => {
    if (!engagementRewards || !userWallet || !isConnected) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      })
      return
    }

    try {
      const inviter =
        localStorage.getItem(INVITE_STORAGE_KEY) ||
        "0x0000000000000000000000000000000000000000"
      const validUntilBlock =
        (await engagementRewards.getCurrentBlockNumber()) + 600n

      // Get app signature from backend
      const appSignature = await fetch(
        "https://v0-eip-712-signature-endpoint.vercel.app/api/sign-claim",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user: userWallet,
            validUntilBlock: validUntilBlock.toString(),
            inviter,
          }),
        },
      )
        .then((res) => res.json())
        .then((data) => data.signature)

      // Get user signature
      const userSignature = await engagementRewards.signClaim(
        env.demoApp,
        inviter as `0x${string}`,
        validUntilBlock,
      )

      // Submit claim transaction
      await engagementRewards.nonContractAppClaim(
        env.demoApp,
        inviter as `0x${string}`,
        validUntilBlock,
        userSignature,
        appSignature,
        (hash) => {
          toast({
            title: "Transaction Submitted",
            description: `Hash: ${hash}`,
          })
        },
      )

      toast({
        title: "Success",
        description: "Reward claimed successfully!",
      })
    } catch (err) {
      console.error("Error claiming reward:", err)
      toast({
        title: "Claim Failed",
        description:
          err instanceof Error
            ? err.message
            : "Could not claim reward. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleVerification = async () => {
    if (!identitySDK) {
      toast({
        title: "Error",
        description: "Identity SDK not initialized",
        variant: "destructive",
      })
      return
    }

    try {
      // Generate FV link with current URL as callback
      const currentUrl = window.location.href
      const fvLink = await identitySDK.generateFVLink(false, currentUrl)
      window.location.href = fvLink
    } catch (err) {
      console.error("Error generating verification link:", err)
      toast({
        title: "Error",
        description: "Failed to generate verification link",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="max-w-4xl w-full mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Invite &amp; Earn Rewards
        </h1>
        <p className="text-xl text-muted-foreground">
          Share your invite link and earn rewards for every new user who joins
        </p>
      </div>

      {!userWallet ? (
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold mb-4">Connect Your Wallet</h2>
          <p className="text-muted-foreground mb-4">
            Connect your wallet to get your unique invite link and start earning
            rewards
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Verification Status</h2>
            {checkingWhitelist ? (
              <p>Checking verification status...</p>
            ) : isWhitelisted ? (
              <p className="text-green-600">Your account is verified! ✓</p>
            ) : (
              <div className="space-y-4">
                <p className="text-yellow-600">
                  Your account needs verification
                </p>
                <Button onClick={handleVerification}>Get Verified</Button>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Your Invite Link</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteLink}
                readOnly
                className="flex-grow p-2 rounded border bg-muted"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyInviteLink}
                className="shrink-0"
                disabled={!isWhitelisted}
              >
                {isCopied ? (
                  <CheckIcon className="h-4 w-4" />
                ) : (
                  <CopyIcon className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {isWhitelisted
                ? `Share this link to earn ${inviterShare}% of ${formatAmount(
                    rewardAmount,
                  )} G$ for each new user who joins!`
                : "Verify your account to start sharing and earning rewards"}
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Your Recent Rewards</h2>
            {inviteRewards.length > 0 ? (
              <div className="space-y-4">
                {inviteRewards.map((reward, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-4 rounded border"
                  >
                    <div>
                      <p className="font-medium">
                        Invited: {reward.invitedWallet}
                      </p>
                    </div>
                    <p className="font-medium">{reward.rewardAmount} G$</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground">
                {isWhitelisted
                  ? "No rewards yet. Share your invite link to start earning!"
                  : "Get verified to start earning rewards"}
              </p>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Claim Your Rewards</h2>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-muted-foreground">Available to claim:</p>
                <p className="text-2xl font-bold">
                  {formatAmount(rewardAmount)} G$
                </p>
              </div>
              <Button
                onClick={claimReward}
                disabled={!isClaimable || !isWhitelisted}
              >
                {!isWhitelisted ? "Verify to Claim" : "Claim Rewards"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

export default InviteDemo

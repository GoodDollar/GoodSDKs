import React, { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { useAccount } from "wagmi"
import { useEngagementRewards, type RewardEvent } from "@GoodSDKs/engagement-sdk"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"
import { formatEther } from "viem"
import { Loader2 } from "lucide-react"
import env from "@/env"
import { TruncatedAddress } from "./ui/TruncatedAddress"

const AppDetailsPage: React.FC = () => {
  const { appAddress } = useParams<{ appAddress: string }>()
  const { isConnected } = useAccount()
  const engagementRewards = useEngagementRewards(env.rewardsContract)
  const [loading, setLoading] = useState(true)
  const [rewards, setRewards] = useState<{
    totalRewards: bigint
    appRewards: bigint
    userRewards: bigint
    inviterRewards: bigint
    rewardEventCount: number
  }>()
  const [events, setEvents] = useState<RewardEvent[]>([])

  useEffect(() => {
    const fetchData = async () => {
      if (!engagementRewards || !appAddress) return
      const [rewardsData, eventsData] = await Promise.all([
        engagementRewards.getAppRewards(appAddress as `0x${string}`),
        engagementRewards.getAppRewardEvents(appAddress as `0x${string}`)
      ])
      setRewards(rewardsData)
      setEvents(eventsData)
      setLoading(false)
    }

    if (isConnected) {
      fetchData()
    }
  }, [isConnected, appAddress, !!engagementRewards])

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>App Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please connect your wallet to view app details.</p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>App Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Total Rewards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <p className="text-4xl font-bold mb-2">
              {formatEther(rewards?.totalRewards || 0n)} G$
            </p>
            <p className="text-xl text-muted-foreground">
              {rewards?.rewardEventCount || 0} Reward Events
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reward Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-semibold">App Share</p>
              <p className="text-2xl">{formatEther(rewards?.appRewards || 0n)} G$</p>
            </div>
            <div>
              <p className="text-lg font-semibold">User Share</p>
              <p className="text-2xl">{formatEther(rewards?.userRewards || 0n)} G$</p>
            </div>
            <div>
              <p className="text-lg font-semibold">Inviter Share</p>
              <p className="text-2xl">{formatEther(rewards?.inviterRewards || 0n)} G$</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Reward Events</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Block</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Inviter</TableHead>
                <TableHead>App Reward</TableHead>
                <TableHead>User Amount</TableHead>
                <TableHead>Inviter Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event, index) => (
                <TableRow key={index}>
                  <TableCell>{event.block.toString()}</TableCell>
                  <TableCell>
                    <TruncatedAddress address={event.user} />
                  </TableCell>
                  <TableCell>
                    <TruncatedAddress address={event.inviter} />
                  </TableCell>
                  <TableCell>{formatEther(event.appReward)} G$</TableCell>
                  <TableCell>{formatEther(event.userAmount)} G$</TableCell>
                  <TableCell>{formatEther(event.inviterAmount)} G$</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default AppDetailsPage

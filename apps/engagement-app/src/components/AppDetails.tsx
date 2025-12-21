import React, { useEffect, useState, useMemo } from "react"
import { useParams } from "react-router-dom"
import { useAccount } from "wagmi"
import {
  RewardEventExtended,
  useEngagementRewards,
} from "@goodsdks/engagement-sdk"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table"
import { formatEther } from "viem"
import { Loader2 } from "lucide-react"
import env from "@/env"
import { TruncatedAddress } from "./ui/TruncatedAddress"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

const BLOCKS_PER_DAY = 60 * 60 * 24 // 1 second per block
const NEW_USER_THRESHOLD = BLOCKS_PER_DAY // 1 day in blocks

interface DailyStats {
  day: string
  dayIndex: number
  totalClaims: number
  newUsers: number
  existingUsers: number
}

const AppDetailsPage: React.FC = () => {
  const { appAddress } = useParams<{ appAddress: string }>()
  const { isConnected } = useAccount()
  const engagementRewards = useEngagementRewards(env.rewardsContract, {
    debug: false,
  })
  const [loading, setLoading] = useState(true)
  const [latestBlock, setLatestBlock] = useState<bigint>(0n)
  const [rewards, setRewards] = useState<{
    totalRewards: bigint
    appRewards: bigint
    userRewards: bigint
    inviterRewards: bigint
    rewardEventCount: number
  }>()
  const [events, setEvents] = useState<RewardEventExtended[]>([])

  useEffect(() => {
    const fetchData = async () => {
      if (!engagementRewards || !appAddress) return
      const currentBlock = await engagementRewards.getCurrentBlockNumber()
      setLatestBlock(currentBlock)

      const [rewardsData, eventsData] = await Promise.all([
        engagementRewards.getAppRewards(appAddress as `0x${string}`),
        engagementRewards.getAppRewardEventsExtended(
          appAddress as `0x${string}`,
          {
            identityContractAddress:
              "0xC361A6E67822a0EDc17D899227dd9FC50BD62F42",
            blocksAgo: 1_200_000n,
          },
        ),
      ])
      setRewards(rewardsData)
      setEvents(eventsData)
      setLoading(false)
    }

    if (isConnected) {
      fetchData()
    }
  }, [isConnected, appAddress, !!engagementRewards])

  const currentTimestamp = Number((Date.now() / 1000).toFixed(0))
  const isNewUser = (event: RewardEventExtended): boolean => {
    if (!latestBlock || !event.userDateAdded) return false
    const eventTimestamp =
      BigInt(currentTimestamp) - (latestBlock - event.block)
    const blocksSinceDateAdded = Number(eventTimestamp - event.userDateAdded)
    return blocksSinceDateAdded < NEW_USER_THRESHOLD
  }
  // Calculate daily stats
  const dailyStats = useMemo<DailyStats[]>(() => {
    if (!latestBlock || events.length === 0) return []
    // Group events by day
    const dayMap = new Map<number, RewardEventExtended[]>()

    events.forEach((event) => {
      const blocksDiff = Number(latestBlock - event.block)
      const dayIndex = Math.floor(blocksDiff / BLOCKS_PER_DAY)
      if (!dayMap.has(dayIndex)) {
        dayMap.set(dayIndex, [])
      }
      dayMap.get(dayIndex)!.push(event)
    })

    // Calculate stats for each day
    const stats: DailyStats[] = []
    Array.from(dayMap.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([dayIndex, dayEvents]) => {
        let newUsers = 0
        let existingUsers = 0

        dayEvents.forEach((event) => {
          if (isNewUser(event)) {
            newUsers++
          } else {
            existingUsers++
          }
        })

        const daysAgo = dayIndex
        const date = new Date()
        date.setDate(date.getDate() - daysAgo)
        const dayLabel = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })

        stats.push({
          day: dayLabel,
          dayIndex,
          totalClaims: dayEvents.length,
          newUsers,
          existingUsers,
        })
      })

    return stats
  }, [latestBlock, events.length])

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
              <p className="text-2xl">
                {formatEther(rewards?.appRewards || 0n)} G$
              </p>
            </div>
            <div>
              <p className="text-lg font-semibold">User Share</p>
              <p className="text-2xl">
                {formatEther(rewards?.userRewards || 0n)} G$
              </p>
            </div>
            <div>
              <p className="text-lg font-semibold">Inviter Share</p>
              <p className="text-2xl">
                {formatEther(rewards?.inviterRewards || 0n)} G$
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {dailyStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Claims Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="newUsers"
                  stackId="a"
                  fill="#3b82f6"
                  name="New Users"
                />
                <Bar
                  dataKey="existingUsers"
                  stackId="a"
                  fill="#10b981"
                  name="Existing Users"
                />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 text-sm text-muted-foreground">
              <p>
                • <span className="text-blue-500">New Users</span>: Verified
                within 1 day of claiming
              </p>
              <p>
                • <span className="text-green-500">Existing Users</span>:
                Verified more than 1 day before claiming
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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
                <TableHead>User Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.slice(-500).map((event, index) => {
                const userType = isNewUser(event) ? "New" : "Existing"
                return (
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
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          userType === "New"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {userType}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default AppDetailsPage

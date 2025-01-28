import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAccount } from "wagmi"
import { useEngagementRewards } from "@GoodSDKs/engagement-sdk"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"
import { formatEther } from "viem"
import { Loader2 } from "lucide-react"
import env from "@/env"

type AppRewardInfo = {
  address: string
  totalRewards: bigint
  appRewards: bigint
  userRewards: bigint
  inviterRewards: bigint
  rewardEventCount: number
}

const RegisteredAppsPage: React.FC = () => {
  const { isConnected } = useAccount()
  const engagementRewards = useEngagementRewards(env.rewardsContract)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [apps, setApps] = useState<AppRewardInfo[]>([])

  useEffect(() => {
    const fetchApps = async () => {
      if (!engagementRewards) return
      const registeredApps = await engagementRewards.getRegisteredApps()
      const appsInfo = await Promise.all(
        registeredApps.map(async (app) => {
          const rewards = await engagementRewards.getAppRewards(app as `0x${string}`)
          return {
            address: app,
            ...rewards
          }
        })
      )
      setApps(appsInfo)
      setLoading(false)
    }

    if (isConnected) {
      fetchApps()
    }
  }, [isConnected, engagementRewards])

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Registered Apps</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please connect your wallet to view registered apps.</p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Registered Apps</CardTitle>
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
    <Card>
      <CardHeader>
        <CardTitle>Registered Apps</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>App Address</TableHead>
              <TableHead>Total Rewards</TableHead>
              <TableHead>Number of Events</TableHead>
              <TableHead>App Share</TableHead>
              <TableHead>User Share</TableHead>
              <TableHead>Inviter Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apps.map((app) => (
              <TableRow 
                key={app.address} 
                className="cursor-pointer hover:bg-accent"
                onClick={() => navigate(`/app/${app.address}`)}
              >
                <TableCell>{app.address}</TableCell>
                <TableCell>{formatEther(app.totalRewards)} G$</TableCell>
                <TableCell>{app.rewardEventCount}</TableCell>
                <TableCell>{formatEther(app.appRewards)} G$</TableCell>
                <TableCell>{formatEther(app.userRewards)} G$</TableCell>
                <TableCell>{formatEther(app.inviterRewards)} G$</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default RegisteredAppsPage

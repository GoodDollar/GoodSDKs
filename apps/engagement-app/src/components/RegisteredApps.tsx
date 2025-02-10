import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAccount } from "wagmi"
import { useEngagementRewards } from "@GoodSDKs/engagement-sdk"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"
import { formatEther } from "viem"
import { Loader2 } from "lucide-react"
import env from "@/env"
import { TruncatedAddress } from "./ui/TruncatedAddress"
import { Button } from "./ui/button"

type AppRewardInfo = {
  address: string
  totalRewards: bigint
  appRewards: bigint
  userRewards: bigint
  inviterRewards: bigint
  rewardEventCount: number
}

type AppInfo = AppRewardInfo & {
  owner: string
  rewardReceiver: string
  userAndInviterPercentage: number
  userPercentage: number
  description: string
  url: string
  email: string
}

const RegisteredAppsPage: React.FC = () => {
  const { isConnected } = useAccount()
  const engagementRewards = useEngagementRewards(env.rewardsContract)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [apps, setApps] = useState<AppInfo[]>([])

  useEffect(() => {
    const fetchApps = async () => {
      if (!engagementRewards) return
      const registeredApps = await engagementRewards.getRegisteredApps()
      const appsInfo = await Promise.all(
        registeredApps.map(async (app) => {
          const [rewards, info] = await Promise.all([
            engagementRewards.getAppRewards(app as `0x${string}`),
            engagementRewards.getAppInfo(app as `0x${string}`)
          ])
          return {
            address: app,
            ...rewards,
            owner: info[0],
            rewardReceiver: info[1],
            userAndInviterPercentage: Number(info[5]),
            userPercentage: Number(info[6]),
            description: info[9],
            url: info[10],
            email: info[11]
          }
        })
      )
      setApps(appsInfo)
      setLoading(false)
    }

    if (isConnected) {
      fetchApps()
    }
  }, [isConnected, !!engagementRewards])

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
              <TableHead>App</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Receiver</TableHead>
              <TableHead>Distribution</TableHead>
              <TableHead>Total Rewards</TableHead>
              <TableHead>Number of Events</TableHead>
              <TableHead>App Share</TableHead>
              <TableHead>User Share</TableHead>
              <TableHead>Inviter Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apps.map((app) => (
              <TableRow key={app.address}>
                <TableCell>
                  <div className="space-y-1">
                    <TruncatedAddress address={app.address} />
                    <a href={app.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:underline">
                      {app.url}
                    </a>
                  </div>
                </TableCell>
                <TableCell>
                  <TruncatedAddress address={app.owner} />
                </TableCell>
                <TableCell>
                  <TruncatedAddress address={app.rewardReceiver} />
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div>User+Inviter: {app.userAndInviterPercentage}%</div>
                    <div>User: {app.userPercentage}%</div>
                  </div>
                </TableCell>
                <TableCell>{formatEther(app.totalRewards)} G$</TableCell>
                <TableCell>{app.rewardEventCount}</TableCell>
                <TableCell>{formatEther(app.appRewards)} G$</TableCell>
                <TableCell>{formatEther(app.userRewards)} G$</TableCell>
                <TableCell>{formatEther(app.inviterRewards)} G$</TableCell>

                <TableCell>
                  <div className="space-y-2">
                    <Button
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => navigate(`/app/${app.address}`)}
                    >
                      Details
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => navigate(`/app/${app.address}/settings`)}
                    >
                      Settings
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => navigate(`/apply/${app.address}`)}
                    >
                      Re-Apply
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default RegisteredAppsPage

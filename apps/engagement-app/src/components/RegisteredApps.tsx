import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAccount } from "wagmi"
import {
  useEngagementRewards,
  type EngagementRewardsSDK,
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
import { Button } from "./ui/button"

const RegisteredAppsPage: React.FC = () => {
  const { isConnected } = useAccount()
  const engagementRewards = useEngagementRewards(env.rewardsContract)

  // Derive AppInfo type from EngagementRewardsSDK type
  type RegisteredApp = Awaited<
    ReturnType<EngagementRewardsSDK["getRegisteredApps"]>
  >[number]
  type AppInfo = RegisteredApp & {
    totalRewards: bigint
    rewardEventCount: number
    appRewards: bigint
    userRewards: bigint
    inviterRewards: bigint
  }

  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [apps, setApps] = useState<AppInfo[]>([])

  useEffect(() => {
    const fetchApps = async () => {
      if (!engagementRewards) return
      const registeredApps = await engagementRewards.getRegisteredApps()
      const appsInfo = await Promise.all(
        registeredApps.map(async (app) => {
          const [rewards] = await Promise.all([
            engagementRewards.getAppRewards(app.app),
          ])
          return {
            ...app,
            ...rewards,
          }
        }),
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
              <TableRow key={app.app}>
                <TableCell>
                  <div className="space-y-1">
                    <TruncatedAddress address={app.app} />
                    <a
                      href={app.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:underline"
                    >
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
                      onClick={() => navigate(`/app/${app.app}`)}
                    >
                      Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => navigate(`/app/${app.app}/settings`)}
                    >
                      Settings
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => navigate(`/apply/${app.app}`)}
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

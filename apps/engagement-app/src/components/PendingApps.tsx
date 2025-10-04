import React, { useEffect, useState } from "react"
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
import { Button } from "./ui/button"
import env from "@/env"
import { useNavigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { TruncatedAddress } from "./ui/TruncatedAddress"

// Derive AppInfo type from EngagementRewardsSDK type
export type AppInfo = Awaited<
  ReturnType<EngagementRewardsSDK["getRegisteredApps"]>
>[number]

const PendingAppsPage: React.FC = () => {
  const { isConnected } = useAccount()
  const engagementRewards = useEngagementRewards(env.rewardsContract) // Replace with actual contract address
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  const [pendingApps, setPendingApps] = useState<Array<AppInfo>>([])

  useEffect(() => {
    const fetchPendingApps = async () => {
      if (!engagementRewards) return
      const apps = await engagementRewards.getPendingApps()
      setPendingApps(apps)
      setLoading(false)
    }

    if (isConnected) {
      fetchPendingApps()
    }
  }, [isConnected, !!engagementRewards])

  const handleApprove = async (app: string) => {
    navigate(`/approve/${app}`)
  }

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Apps</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please connect your wallet to view pending apps.</p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Apps</CardTitle>
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
        <CardTitle>Pending Apps</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>App Address</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Reward Receiver</TableHead>
              <TableHead>User & Inviter %</TableHead>
              <TableHead>User %</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingApps.map((app) => (
              <TableRow key={app.app}>
                <TableCell>
                  <TruncatedAddress address={app.app} />
                </TableCell>
                <TableCell>
                  <TruncatedAddress address={app.owner} />
                </TableCell>
                <TableCell>
                  <TruncatedAddress address={app.rewardReceiver} />
                </TableCell>
                <TableCell>{app.userAndInviterPercentage}%</TableCell>
                <TableCell>{app.userPercentage}%</TableCell>
                <TableCell>{app.description}</TableCell>
                <TableCell>
                  <a
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {app.url}
                  </a>
                </TableCell>
                <TableCell>
                  <a href={`mailto:${app.email}`} className="hover:underline">
                    {app.email}
                  </a>
                </TableCell>
                <TableCell>
                  <Button onClick={() => handleApprove(app.app)}>
                    Approve
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default PendingAppsPage

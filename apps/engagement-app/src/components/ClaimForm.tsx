import type React from "react"
import { useState, useEffect } from "react"
import { useAccount, useSignTypedData } from "wagmi"
import { useEngagementRewards } from "@GoodSDKs/engagement-sdk"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Button } from "./ui/button"
import { Label } from "./ui/label"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import env from "@/env"
import { zeroAddress } from "viem"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"

const ClaimForm: React.FC = () => {
  const { isConnected, chainId } = useAccount()
  const engagementRewards = useEngagementRewards(env.rewardsContract) // Replace with actual contract address
  const { toast } = useToast()
  const { signTypedDataAsync } = useSignTypedData()

  const [app, setApp] = useState("")
  const [inviter, setInviter] = useState("")
  const nonce = Date.now()
  const [registeredApps, setRegisteredApps] = useState<string[]>([])
  const [appDescription, setAppDescription] = useState("")
  const [showSigningModal, setShowSigningModal] = useState(false)

  useEffect(() => {
    if (!engagementRewards || registeredApps.length > 0) return

    const fetchRegisteredApps = async () => {
      const apps = await engagementRewards.getRegisteredApps()
      console.log(apps)
      setRegisteredApps(apps)
    }

    if (isConnected) {
      fetchRegisteredApps()
    }
  }, [isConnected, engagementRewards, registeredApps.length])


  const handleAppChange = async (value: string) => {
    if (!engagementRewards) return
    setApp(value)
    const appInfo = await engagementRewards.getAppInfo(value as `0x${string}`)
    setAppDescription(appInfo[9])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!engagementRewards) return;
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Please connect your wallet first.",
        variant: "destructive",
      })
      return
    }

    try {
      setShowSigningModal(true) // Show modal before signing
      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId, // Replace with the correct chain ID
        verifyingContract: env.rewardsContract, // Replace with the actual contract address
      }

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      }

      const currentBlock = await engagementRewards.getCurrentBlockNumber();

      const message = {
        app: app,
        inviter: inviter || zeroAddress,
        validUntilBlock: currentBlock,
        description: appDescription,
      }

      const signature = await signTypedDataAsync({ domain, types, message, primaryType: "Claim" })
      setShowSigningModal(false) // Hide modal after signing

      await engagementRewards.claimWithSignature(app as `0x${string}`, message.inviter as `0x${string}`, currentBlock, signature)


      toast({
        title: "Success",
        description: "Claim submitted successfully!",
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      setShowSigningModal(false) // Hide modal if there's an error
      console.error("Error claiming:", error)
      toast({
        title: "Error",
        description: `Failed to submit claim. Please try again.<br>${error.message}`,
        variant: "destructive",
      })
    }
  }

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Claim Rewards</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please connect your wallet to claim rewards.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Claim Rewards</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="app">App</Label>
              <Select onValueChange={handleAppChange} value={app}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an app" />
                </SelectTrigger>
                <SelectContent>
                  {registeredApps.map((app) => (
                    <SelectItem key={app} value={app}>
                      {app}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="inviter">Inviter Address</Label>
              <Input
                id="inviter"
                value={inviter}
                onChange={(e) => setInviter(e.target.value)}
                placeholder="0x... (optional)"
              />
            </div>
            <div>
              <Label htmlFor="nonce">Nonce</Label>
              <p className="text-sm text-gray-500">{nonce}</p>

            </div>
            <div>
              <Label>App Description</Label>
              <p className="text-sm text-gray-500">{appDescription}</p>
            </div>
            <Button type="submit">Claim</Button>
          </form>
        </CardContent>
      </Card>
      <Dialog open={showSigningModal} onOpenChange={setShowSigningModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign Message</DialogTitle>
            <DialogDescription>
              Please sign the message in your wallet to proceed with the claim.
              This signature is required to verify your identity and complete the claim process.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ClaimForm


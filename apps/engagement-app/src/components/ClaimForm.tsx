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
import { useSigningModal } from "@/hooks/useSigningModal"
import { SigningModal } from "./SigningModal"


const ClaimForm: React.FC = () => {
  const { isConnected, chainId } = useAccount()
  const engagementRewards = useEngagementRewards(env.rewardsContract) // Replace with actual contract address
  const { toast } = useToast()
  const { signTypedDataAsync } = useSignTypedData()
  const { isSigningModalOpen, setIsSigningModalOpen, wrapWithSigningModal } = useSigningModal();

  const [app, setApp] = useState("")
  const [inviter, setInviter] = useState("")
  const [appSignature, setAppSignature] = useState("")
  const nonce = Date.now()
  const [registeredApps, setRegisteredApps] = useState<string[]>([])
  const [appDescription, setAppDescription] = useState("")

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, registeredApps.length, !!engagementRewards])


  const handleAppChange = async (value: string) => {
    if (!engagementRewards) return
    setApp(value)
    const appInfo = await engagementRewards.getAppInfo(value as `0x${string}`)    
    if(appInfo) setAppDescription(appInfo[9])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!engagementRewards) return;
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    await wrapWithSigningModal(async () => {      
      const currentBlock = await engagementRewards.getCurrentBlockNumber();
      const validUntilBlock = currentBlock + 10n;

      // Get user signature
      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: env.rewardsContract,
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const message = {
        app: app,
        inviter: inviter || zeroAddress,
        validUntilBlock: validUntilBlock,
        description: appDescription,
      };

      const userSignature = await signTypedDataAsync({
        domain,
        types,
        message,
        primaryType: "Claim",
      });

      const receipt = await engagementRewards.nonContractAppClaim(
        app as `0x${string}`,
        message.inviter as `0x${string}`,
        validUntilBlock,
        userSignature,
        appSignature as `0x${string}`,
        (hash: string) => {
          toast({
            title: "Transaction Submitted",
            description: `Transaction hash: ${hash}`,
          });
        }
      );

      return receipt;
    }, "Claim submitted successfully!");
  };

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
              <Label htmlFor="appSignature">App Signature</Label>
              <Input
                id="appSignature"
                value={appSignature}
                onChange={(e) => setAppSignature(e.target.value)}
                placeholder="0x..."
              />
              <p className="text-sm text-gray-500">The app signature should be obtained from your backend or app owner.</p>
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
      <SigningModal 
        open={isSigningModalOpen} 
        onOpenChange={setIsSigningModalOpen}
      />
    </>
  )
}

export default ClaimForm


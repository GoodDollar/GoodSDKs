import type React from "react"
import { useState, useEffect } from "react"
import { useAccount, useSignTypedData } from "wagmi"
import { useEngagementRewards } from "@GoodSDKs/engagement-sdk"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Button } from "./ui/button"
import { Label } from "./ui/label"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import env from "@/env"
import { zeroAddress } from "viem"
import { useSigningModal } from "@/hooks/useSigningModal"
import { SigningModal } from "./SigningModal"
import { Check } from "lucide-react"

const ClaimForm: React.FC = () => {
  const { isConnected, chainId, address } = useAccount()
  const engagementRewards = useEngagementRewards(env.rewardsContract) // Replace with actual contract address
  const { toast } = useToast()
  const { signTypedDataAsync } = useSignTypedData()
  const { isSigningModalOpen, setIsSigningModalOpen, wrapWithSigningModal } = useSigningModal();

  const [app, setApp] = useState("")
  const [inviter, setInviter] = useState("")
  const [appSignature, setAppSignature] = useState("")
  const [generatedAppSignature, setGeneratedAppSignature] = useState<string | null>(null);
  const [appSignatureUser, setAppSignatureUser] = useState("")
  const [registeredApps, setRegisteredApps] = useState<string[]>([])
  const [appDescription, setAppDescription] = useState("")
  const [validUntilBlock, setValidUntilBlock] = useState<bigint>(0n);
  const [isAppSignatureValidSigner, setIsAppSignatureValidSigner] = useState(true);

  useEffect(() => {
    if (!engagementRewards) return;

    const fetchRegisteredApps = async () => {
      const apps = await engagementRewards.getRegisteredApps();
      setRegisteredApps(apps);
    };

    const fetchCurrentBlock = async () => {
      const currentBlock = await engagementRewards.getCurrentBlockNumber();
      setValidUntilBlock(currentBlock + 50n);
    };

    if (isConnected) {
      fetchRegisteredApps();
      fetchCurrentBlock();
    }
  }, [isConnected, !!engagementRewards]);

  useEffect(() => {
    if (app && address) {
      setIsAppSignatureValidSigner(app.toLowerCase() === address.toLowerCase());
    } else {
      setIsAppSignatureValidSigner(true);
    }
  }, [app, address]);

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

  const handleGenerateAppSignature = async () => {
    if (!engagementRewards || !app || !appSignatureUser) return;

    try {
      const { domain, types, message } = await engagementRewards.prepareAppSignature(
        app as `0x${string}`,
        appSignatureUser as `0x${string}`,
        validUntilBlock
      );

      const signature = await signTypedDataAsync({
        domain,
        types,
        message,
        primaryType: "AppClaim",
      });

      setGeneratedAppSignature(signature);
    } catch (error) {
      console.error("Error generating app signature:", error);
      toast({
        title: "Error",
        description: "Failed to generate app signature.",
        variant: "destructive",
      });
    }
  };

  const handleCopyToClipboard = () => {
    if (generatedAppSignature) {
      navigator.clipboard.writeText(generatedAppSignature);
      toast({
        title: "Copied!",
        description: "App signature copied to clipboard.",
      });
    }
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
              <Label htmlFor="nonce">Valid Until Block</Label>
              <p className="text-sm text-gray-500">{validUntilBlock.toString()}</p>
            </div>
            <div>
              <Label>App Description</Label>
              <p className="text-sm text-gray-500">{appDescription}</p>
            </div>
            <Button type="submit">Claim</Button>
          </form>
        </CardContent>
      </Card>
      <Card className="w-full max-w-2xl mx-auto mt-8">
        <CardHeader>
          <CardTitle>Generate App Signature</CardTitle>
          <CardDescription>
            Use this form to generate an app signature for testing purposes.
            In production, this should be done on your backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="appSignatureUser">User Address</Label>
            <Input
              id="appSignatureUser"
              value={appSignatureUser}
              onChange={(e) => setAppSignatureUser(e.target.value)}
              placeholder="0x..."
            />
            <p className="text-sm text-gray-500">Enter the user address for whom the app signature is generated.</p>
          </div>
          <Button
            onClick={handleGenerateAppSignature}
            disabled={!isAppSignatureValidSigner}
          >
            Generate App Signature
          </Button>
          {!isAppSignatureValidSigner && (
            <p className="text-sm text-red-500">
              You must connect with the same address as the selected app to generate the app signature.
            </p>
          )}
          {generatedAppSignature && (
            <div className="space-y-2">
              <Label>Generated App Signature</Label>
              <Input
                readOnly
                value={generatedAppSignature}
                placeholder="0x..."
              />
              <Button onClick={handleCopyToClipboard} variant="secondary">
                <Check className="mr-2 h-4 w-4" />
                Copy to Clipboard
              </Button>
            </div>
          )}
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


import React, { useEffect } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Button } from "./ui/button"
import { Check } from "lucide-react"
import Prism from "prismjs"
import "prismjs/themes/prism-tomorrow.css"
import "prismjs/components/prism-typescript"
import "prismjs/components/prism-solidity"
import {
  DEV_REWARDS_CONTRACT,
  REWARDS_CONTRACT,
} from "@goodsdks/engagement-sdk"

// Add these styles to ensure code visibility
const codeBlockStyles = {
  pre: "bg-zinc-950 p-4 rounded-lg overflow-x-auto relative",
  code: "block text-sm text-zinc-50 font-mono",
  copyButton:
    "absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity",
}

const CodeBlock: React.FC<{ code: string; language: string }> = ({
  code,
  language,
}) => {
  useEffect(() => {
    Prism.highlightAll()
  }, [code])

  return (
    <div className="group relative">
      <pre className={codeBlockStyles.pre}>
        <Button
          size="sm"
          variant="outline"
          className={codeBlockStyles.copyButton}
          onClick={() => navigator.clipboard.writeText(code)}
        >
          <Check className="h-4 w-4" />
        </Button>
        <code className={`${codeBlockStyles.code} language-${language}`}>
          {code}
        </code>
      </pre>
    </div>
  )
}

// Add global styles to your CSS (tailwind.css or similar)
const globalStyles = `
  /* Add these to your global CSS */
  pre {
    background-color: rgb(24 24 27) !important;
    color: #fff !important;
  }
  
  code {
    color: #fff !important;
    text-shadow: none !important;
  }
  
  .token.comment { color: #888 !important; }
  .token.string { color: #a5d6ff !important; }
  .token.number { color: #ff9580 !important; }
  .token.keyword { color: #ff7b72 !important; }
  .token.function { color: #d2a8ff !important; }
  .token.boolean { color: #ff7b72 !important; }
`

const IntegrationGuide: React.FC = () => {
  useEffect(() => {
    // Insert global styles
    const styleSheet = document.createElement("style")
    styleSheet.innerText = globalStyles
    document.head.appendChild(styleSheet)
    return () => {
      document.head.removeChild(styleSheet)
    }
  }, [])

  // const copyToClipboard = (code: string) => {
  //   navigator.clipboard.writeText(code)
  // }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <h1 className="text-4xl font-bold mb-4">Integration Guide</h1>

      <Card>
        <CardHeader>
          <CardTitle>Before You Start</CardTitle>
          <CardDescription>
            Prerequisites and important concepts to understand
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Before applying make sure you smart contract is deployed and
              verified on sourcify.dev
            </li>
            <li>
              Your app/smart contract must be registered and approved in the
              EngagementRewards contract
            </li>
            <li>
              Users must have whitelisted status in the Identity contract
              <ul className="list-disc pl-6 mt-2">
                <li>
                  Users can be verified on{" "}
                  <a
                    href="https://goodwallet.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-600"
                  >
                    https://goodwallet.xyz
                  </a>{" "}
                  or{" "}
                  <a
                    href="https://gooddapp.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-600"
                  >
                    https://gooddapp.org
                  </a>
                </li>
                <li>
                  Alternatively you can integrate verification in your app. See:{" "}
                  <a
                    href="https://docs.gooddollar.org/for-developers/apis-and-sdks/sybil-resistance"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-600"
                  >
                    https://docs.gooddollar.org/for-developers/apis-and-sdks/identity-sybil-resistance
                  </a>
                </li>
                <li>
                  <b>Note:</b> Only the user claiming the reward must be
                  whitelisted. The inviter does <b>not</b> need to be
                  whitelisted.
                </li>
              </ul>
            </li>
            <li>
              Users can only claim rewards once per cooldown period (180 days)
            </li>
            <li>Apps have a maximum reward limit that resets every 180 days</li>
            <li>
              Apps get rewards for users that didn't yet receive rewards from 3
              other apps. This limit resets every 180 days. If your app is the
              4th the user has used in the period your app will not get the
              reward.
            </li>
            <li>
              For development purposes, you can use the{" "}
              <b>DEV_REWARDS_CONTRACT</b> which allows anyone to approve apps.
              You can access the development environment at{" "}
              <a
                href="https://engagement-rewards-dev.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-blue-600"
              >
                https://engagement-rewards-dev.vercel.app
              </a>
              .
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contract Addresses</CardTitle>
          <CardDescription>
            Smart contract addresses for development and production environments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">
                Development (Celo Mainnet)
              </h3>
              <div className="space-y-2">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">
                    Engagement Rewards Contract:
                  </p>
                  <a
                    href={`https://celoscan.io/address/${DEV_REWARDS_CONTRACT}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs break-all text-blue-600 hover:underline"
                  >
                    {DEV_REWARDS_CONTRACT}
                  </a>
                </div>
                <p className="text-sm text-muted-foreground">
                  Use these addresses for testing. Anyone can approve apps in
                  development environment.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold">
                Production (Celo Mainnet)
              </h3>
              <div className="space-y-2">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">
                    Engagement Rewards Contract:
                  </p>
                  <a
                    href={`https://celoscan.io/address/${REWARDS_CONTRACT}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs break-all text-blue-600 hover:underline"
                  >
                    {REWARDS_CONTRACT}
                  </a>
                </div>
                <p className="text-sm text-muted-foreground">
                  Use these addresses for production deployments. Apps require
                  approval from Good Labs.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Signatures</CardTitle>
          <CardDescription>
            Understanding when user signatures are required
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="list-disc pl-6 space-y-2">
            <li>
              A user signature is required when:
              <ul className="list-disc pl-6 mt-2">
                <li>First time user interacts with your app</li>
                <li>After an app has been re-applied (new registration)</li>
              </ul>
            </li>
            <li>Once registered, subsequent claims don't require signatures</li>
            <li>
              See client-side integration for how to obtain user signatures
            </li>
          </ul>
        </CardContent>
      </Card>

      <p className="text-base text-muted-foreground mb-4">
        <b>Choose one integration method:</b> You must implement <b>either</b>{" "}
        the Smart Contract Integration <b>or</b> the Client-Side Integration in
        your app. Both methods are supported, but only one is required.
      </p>

      <Tabs defaultValue="smart-contract">
        <TabsList className="border-b-0 bg-transparent flex justify-start gap-4 mb-6">
          <TabsTrigger
            value="smart-contract"
            className="px-6 py-3 text-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-colors"
          >
            Smart Contract + Client Side Integration
          </TabsTrigger>
          <TabsTrigger
            value="client"
            className="px-6 py-3 text-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-colors"
          >
            Client-Side Only Integration
          </TabsTrigger>
          <TabsTrigger
            value="invite"
            className="px-6 py-3 text-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-colors"
          >
            Invite Link Example Integration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="smart-contract" className="space-y-6">
          {/* Integration-specific explanation */}
          <Card>
            <CardHeader>
              <CardTitle>Smart Contract Integration</CardTitle>
              <CardDescription>
                Integrate directly through your smart contract
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <b>How it works:</b> Your app's smart contract calls the{" "}
                <span className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-100 font-mono">
                  appClaim
                </span>{" "}
                function on the EngagementRewards contract when a user completes
                an action (e.g., wins a game or achieves something). The
                contract verifies the action and submits the claim on-chain.
                <br />
                <b>Key points:</b>
                <ul className="list-disc pl-6 mt-2">
                  <li>
                    <b>
                      All reward logic and eligibility checks are enforced
                      on-chain in your contract.
                    </b>
                  </li>
                  <li>
                    <b>User signatures</b> are only required for first-time
                    registration or after re-applying your app.
                  </li>
                  <li>
                    <b>Custom reward percentages</b> can be set dynamically by
                    your contract logic
                  </li>
                  <li>
                    <b>Gas fees</b> are paid by the user for each claim.
                  </li>
                  <li>
                    <b>Frontend</b> only needs to call your contract; it does
                    not interact with EngagementRewards directly.
                  </li>
                  <li>
                    <b>Best for:</b> On-chain games, dApps with custom logic, or
                    when you want all logic to be transparent and trustless.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  1. Interface Definition
                </h3>
                <CodeBlock
                  language="solidity"
                  code={`interface IEngagementRewards {
    function appClaim(
        address user,
        address inviter,
        uint256 validUntilBlock,
        bytes memory signature
    ) external returns (bool);

    function appClaim(
        address user,
        address inviter,
        uint256 validUntilBlock,
        bytes memory signature,
        uint8 userAndInviterPercentage,
        uint8 userPercentage
    ) external returns (bool);

    // For non-contract apps that need to provide their signature
    function nonContractAppClaim(
        address app,
        address inviter,
        uint256 validUntilBlock,
        bytes memory userSignature,
        bytes memory appSignature
    ) external returns (bool);
}`}
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Smart Contract Implementation
                </h3>
                <CodeBlock
                  language="solidity"
                  code={`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract GameApp {
    IEngagementRewards public immutable engagementRewards;
    
    // Internal game state
    mapping(address => uint256) public playerLevel;
    mapping(address => uint256) public gamesWon;
    mapping(address => uint256) public lastActionTimestamp;
    
    constructor(address _engagementRewards) {
        engagementRewards = IEngagementRewards(_engagementRewards);
    }

    // Example 1: Direct claim from contract
    function winGame(
        uint256 score,
        uint8 difficulty,
        address inviter,
        uint256 validUntilBlock,
        bytes memory signature,
        bytes32 gameProof
    ) external {
        require(_verifyGameWin(score, difficulty, gameProof), "Invalid game proof");
        
        // Try to claim reward but don't block game progress
        try engagementRewards.appClaim(
            msg.sender,
            inviter,
            validUntilBlock,
            signature
        ) returns (bool success) {
            if (!success) {
                emit RewardClaimFailed("Claim returned false");
            }
        } catch Error(string memory reason) {
            emit RewardClaimFailed(reason);
        } catch {
            emit RewardClaimFailed("unknown error");
        }

        // Continue with game logic
        _handleGameWin(msg.sender, score);
    }

    // Example 2: Advanced reward with custom amounts based on achievement
    function completeAchievement(
        address inviter,
        string calldata achievementId,
        uint256 validUntilBlock,
        bytes memory signature
    ) external {
        require(_verifyAchievement(achievementId), "Invalid achievement");
        
        // Calculate rewards based on player stats (returns uint8)
        uint8 userInviterShare = calculateUserInviterShare(msg.sender);
        uint8 userShare = calculateUserShare(msg.sender);

        try engagementRewards.appClaim(
            msg.sender,
            inviter,
            validUntilBlock,
            signature,
            userInviterShare,
            userShare
        ) returns (bool success) {
            if (!success) {
                emit RewardClaimFailed("Achievement claim failed");
            }
        } catch Error(string memory reason) {
            emit RewardClaimFailed(reason);
        } catch {
            emit RewardClaimFailed("unknown error");
        }

        // Continue with achievement logic
        _handleAchievement(msg.sender, achievementId);
    }

    // Internal reward calculation based on player stats
    function calculateUserInviterShare(address player) internal view returns (uint8) {
        uint256 level = playerLevel[player];
        return uint8(60 + (level * 30) / 100); // Base 60% + up to 30% based on level
    }

    function calculateUserShare(address player) internal view returns (uint8) {
        uint256 wins = gamesWon[player];
        return uint8(70 + (wins * 20) / 100); // Base 70% + up to 20% based on wins
    }

    // Game logic (simplified for example)
    function _verifyGameWin(uint256 score, uint8 difficulty, bytes32 proof) internal pure returns (bool) {
        // Your game verification logic
        return true;
    }

    function _verifyAchievement(string calldata id) internal pure returns (bool) {
        // Your achievement verification logic
        return true;
    }

    function _handleGameWin(address player, uint256 score) internal {
        gamesWon[player]++;
        lastActionTimestamp[player] = block.timestamp;
        // Additional game logic...
    }

    function _handleAchievement(address player, string calldata achievementId) internal {
        // Achievement logic...
    }

    event RewardClaimFailed(string reason);
}`}
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Frontend Integration with Smart Contract App
                </h3>
                <CodeBlock
                  language="typescript"
                  code={`// Example of frontend integration with GameApp contract
import { useContractWrite } from 'wagmi'
import { useEngagementRewards, DEV_REWARDS_CONTRACT, REWARDS_CONTRACT } from '@goodsdks/engagement-sdk'

const GameComponent = () => {
  const { data: gameApp } = useContract({
    address: GAME_APP_ADDRESS,
    abi: gameAppABI
  })
  const engagementRewards = useEngagementRewards(REWARDS_CONTRACT)

  const handleWinGame = async (score: number, difficulty: number, inviter: string) => {
    try {
      // 1. Get current block for signature
      const currentBlock = await engagementRewards.getCurrentBlockNumber()
      const validUntilBlock = currentBlock + 10n // Valid for 10 blocks

      // Generate signature for first-time users or after app re-apply
      let signature = "0x"
      if (!(await engagementRewards.isUserRegistered(GAME_APP_ADDRESS, userAddress))) {
        signature = await engagementRewards.signClaim(
          APP_ADDRESS,
          INVITER_ADDRESS,
          validUntilBlock
        )
      }

      // 5. Generate game proof (implementation depends on your game)
      const gameProof = await generateGameProof(score, difficulty)

      // 6. Call the game contract
      const tx = await gameApp.write.winGame([
        score,
        difficulty,
        inviter,
        validUntilBlock,
        signature,
        gameProof
      ])

      await tx.wait()
      console.log('Game win and reward claim processed!')
    } catch (error) {
      console.error('Error processing game win:', error)
    }
  }`}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">
                  Smart Contract Integration Notes
                </h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    User signature is only needed for first-time registration
                    with your app
                  </li>
                  <li>Subsequent claims can pass empty signature (0x)</li>
                  <li>
                    Your contract is responsible for validating game/achievement
                    proofs
                  </li>
                  <li>
                    Reward claiming should not block core game functionality
                  </li>
                  <li>
                    Consider implementing fallback logic if reward claiming
                    fails
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Important Notes</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    Custom reward percentages should be determined by your
                    contract's business logic
                  </li>
                  <li>
                    Never accept percentage values directly from user input
                  </li>
                  <li>Use try/catch to handle errors properly</li>
                  <li>
                    Consider caching successful claims to prevent unnecessary
                    contract calls
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="client" className="space-y-6">
          {/* Integration-specific explanation */}
          <Card>
            <CardHeader>
              <CardTitle>Client-Side Integration</CardTitle>
              <CardDescription>
                Integrate using the engagement-sdk directly in your dApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <b>How it works:</b> Your frontend and backend use the
                EngagementRewards SDK to check eligibility and submit claims
                directly, without any custom smart contract. The backend signs
                claims as the app.
                <br />
                <b>Key points:</b>
                <ul className="list-disc pl-6 mt-2">
                  <li>
                    <b>
                      All reward logic and eligibility checks happen off-chain
                    </b>{" "}
                    in your frontend/backend using the SDK.
                  </li>
                  <li>
                    <b>User signatures</b> are required for first-time
                    registration or after re-applying your app, and are
                    generated in the frontend.
                  </li>
                  <li>
                    <b>App signatures</b> are generated by your backend using
                    your app's private key.
                  </li>
                  <li>
                    <b>No custom smart contract is needed</b>; you interact
                    directly with the EngagementRewards contract via the SDK.
                  </li>
                  <li>
                    <b>Gas fees</b> are still paid by the user for the claim
                    transaction, but all business logic is off-chain.
                  </li>
                  <li>
                    <b>Best for:</b> Apps without custom on-chain logic,
                    web2-style apps, or when you want to minimize smart contract
                    development.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">1. SDK Setup</h3>
                <CodeBlock
                  language="typescript"
                  code={`import { useEngagementRewards,REWARDS_CONTRACT,DEV_REWARDS_CONTRACT } from '@goodsdks/engagement-sdk'

const MyComponent = () => {
  const engagementRewards = useEngagementRewards(REWARDS_CONTRACT)
  
  // SDK is ready when hook returns non-null
  if (!engagementRewards) return null
}`}
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  2. Check Eligibility & Claim
                </h3>
                <CodeBlock
                  language="typescript"
                  code={`const handleClaim = async () => {
  try {
    // First check if user can claim
    const isEligible = await engagementRewards.canClaim(APP_ADDRESS, userAddress).catch(_ => false)
    if (!isEligible) {
      throw new Error("User not eligible to claim")
    }

    // Get current block and prepare signature if needed
    const currentBlock = await engagementRewards.getCurrentBlockNumber()
    const validUntilBlock = currentBlock + 10n // Valid for 10 blocks

    // Generate signature for first-time users or after app re-apply
    let signature = "0x"
    if (!(await engagementRewards.isUserRegistered(APP_ADDRESS, userAddress))) {
      signature = await engagementRewards.signClaim(
        APP_ADDRESS,
        INVITER_ADDRESS,
        validUntilBlock
      )
    }


    // Get app signature from backend
    const appSignature = await getAppSignature({
      user: userAddress,
      validUntilBlock: validUntilBlock.toString(),
      inviter: INVITER_ADDRESS
    })
      
    // Submit claim
    const receipt = await engagementRewards.nonContractAppClaim(
      APP_ADDRESS,
      INVITER_ADDRESS,
      validUntilBlock,
      userSignature,
      appSignature
    )
  } catch (error) {
    console.error("Claim failed:", error)
  }
}`}
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  3. Get App Signature from Backend
                </h3>
                <CodeBlock
                  language="typescript"
                  code={`// Example of getting app signature from backend
const getAppSignature = async (params: {
  user: string,
  validUntilBlock: string,
  inviter: string
}) => {
  try {
    const response = await fetch('https://your-backend/api/sign-claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${YOUR_AUTH_TOKEN}\`
      },
      body: JSON.stringify(params)
    })

    if (!response.ok) {
      throw new Error('Failed to get app signature')
    }

    const { signature } = await response.json()
    return signature as \`0x\${string}\`
  } catch (error) {
    console.error('Error getting app signature:', error)
    throw new Error('Failed to get app signature')
  }
}`}
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  4. Backend Implementation Example
                </h3>
                <CodeBlock
                  language="typescript"
                  code={`// Example Node.js/Express backend endpoint
import { createWalletClient, http, parseEther, createPublicClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'
import { EngagementRewardsSDK } from '@goodsdks/engagement-sdk'
import express from 'express'

const router = express.Router()

// App configuration should be in environment variables
const APP_PRIVATE_KEY = process.env.APP_PRIVATE_KEY! as \`0x\${string}\`
const APP_ADDRESS = process.env.APP_ADDRESS! as \`0x\${string}\`
const REWARDS_CONTRACT = process.env.REWARDS_CONTRACT! as \`0x\${string}\`

// Initialize viem clients
const account = privateKeyToAccount(APP_PRIVATE_KEY)
const publicClient = createPublicClient({ 
  chain: celo,
  transport: http()
})
const walletClient = createWalletClient({ 
  chain: celo,
  transport: http(),
  account
})

// Initialize SDK
const engagementRewards = new EngagementRewardsSDK(
  publicClient,
  walletClient,
  REWARDS_CONTRACT
)

router.post('/api/sign-claim', async (req, res) => {
  try {
    const { user, validUntilBlock, inviter } = req.body
    if (!user || !validUntilBlock) {
      return res.status(400).json({ error: 'Missing required parameters' })
    }

    // Validate user is authorized to request signature
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Use SDK to prepare signature data
    const { domain, types, message } = await engagementRewards.prepareAppSignature(
      APP_ADDRESS,
      user as \`0x\${string}\`,
      BigInt(validUntilBlock)
    )

    // Sign the prepared data
    const signature = await walletClient.signTypedData({
      domain,
      types, 
      primaryType: 'AppClaim',
      message
    })

    // Log signature request for auditing
    await logSignatureRequest({
      app: APP_ADDRESS,
      user,
      inviter,
      validUntilBlock,
      signature
    })

    return res.json({ signature })
  } catch (error) {
    console.error('Error signing message:', error)
    return res.status(500).json({ error: 'Failed to sign message' })
  }
})
// ...existing code...
`}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">
                  Security Considerations
                </h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Never expose your app's private key in frontend code</li>
                  <li>
                    Implement proper authentication for signature requests
                  </li>
                  <li>Add rate limiting to prevent signature request abuse</li>
                  <li>Validate all user inputs on the backend</li>
                  <li>Keep logs of all signature requests for auditing</li>
                  <li>
                    Consider using a dedicated signing service/HSM for
                    production
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invite" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invite Link Integration</CardTitle>
              <CardDescription>
                Generate an invite link using only the inviter address, store it
                in localStorage, and use it during claim.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  1. Generate Invite Link
                </h3>
                <CodeBlock
                  language="typescript"
                  code={`
// Function to generate an invite link using the inviter address only
const generateInviteLink = (inviterAddress: string) => {
  const baseUrl = window.location.origin; // or your dApp base URL
  const inviteCode = btoa(JSON.stringify({ inviter: inviterAddress }));
  return \`\${baseUrl}/?invite=\${inviteCode}\`;
};

// Usage example:
const inviter = "0xYourInviterAddress";
const inviteLink = generateInviteLink(inviter);
console.log("Invite Link:", inviteLink);
            `}
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  2. Store and Retrieve Inviter from localStorage
                </h3>
                <CodeBlock
                  language="typescript"
                  code={`
// Save inviter from the invite link to localStorage
const saveInviter = (inviter: string) => {
  localStorage.setItem("invite_inviter", inviter);
};

// Retrieve the stored inviter
const getStoredInviter = (): string | null => {
  return localStorage.getItem("invite_inviter");
};

// On app load, parse URL and store inviter if present
const parseAndStoreInviter = () => {
  const params = new URLSearchParams(window.location.search);
  const inviteCode = params.get("invite");
  if (inviteCode) {
    try {
      const { inviter } = JSON.parse(atob(inviteCode));
      if (inviter) {
        saveInviter(inviter);
      }
    } catch (error) {
      console.error("Invalid invite code", error);
    }
  }
};

parseAndStoreInviter();

// Later, when claiming rewards:
const inviterForClaim = getStoredInviter() || "0x0000000000000000000000000000000000000000";
console.log("Inviter for Claim:", inviterForClaim);
            `}
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  3. Use Inviter in Claim Function
                </h3>
                <CodeBlock
                  language="typescript"
                  code={`
// Example claim function using the stored inviter address
const handleClaim = async () => {
  const inviterAddress = getStoredInviter() || "0x0000000000000000000000000000000000000000";
  // Proceed with claim by passing the inviterAddress
  const receipt = await engagementRewards.nonContractAppClaim(
    APP_ADDRESS,
    inviterAddress,
    validUntilBlock,
    userSignature,
    appSignature
  );
  console.log("Claim Receipt:", receipt);
};
            `}
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  4. Track Inviter Rewards via Events
                </h3>
                <CodeBlock
                  language="typescript"
                  code={`
import {
  DEFAULT_EVENT_BATCH_SIZE,
  DEFAULT_EVENT_LOOKBACK,
} from '@goodsdks/engagement-sdk'

const loadInviterRewards = async (
  appAddress: \`0x\${string}\`,
  inviterAddress: \`0x\${string}\`,
) => {
  if (!engagementRewards) {
    return { events: [], totalInviterRewards: 0n }
  }

  const events = await engagementRewards.getAppRewardEvents(appAddress, {
    inviter: inviterAddress,
    blocksAgo: DEFAULT_EVENT_LOOKBACK, // narrow or expand the window as needed
    batchSize: DEFAULT_EVENT_BATCH_SIZE,
    // cacheKey: 'invite-history-<$>{inviterAddress}', // optional override
  })

  const totalInviterRewards = events.reduce(
    (sum, event) => sum + event.inviterAmount,
    0n,
  )

  return { events, totalInviterRewards }
}
            `}
                />
                <p className="text-sm text-muted-foreground">
                  Use the optional <code>inviter</code> filter to ask the RPC
                  for inviter-specific logs without fetching every event. Adjust
                  the
                  <code>blocksAgo</code> and <code>batchSize</code> values, or
                  reuse the exported defaults, to tune how much history you
                  scan. The SDK remembers the last processed block range in
                  localStorage so future calls only fetch new events—pass
                  <code>resetCache: true</code> to replay history or
                  <code>disableCache: true</code> when running server-side.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Best Practices</CardTitle>
          <CardDescription>
            Tips to maximize engagement and rewards effectiveness
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Reward Distribution 💰</h3>
              <ul className="list-disc pl-6 space-y-2 text-sm">
                <li>
                  Higher rewards for first-time users can help with initial
                  adoption
                </li>
                <li>
                  Consider increasing rewards for power users and active
                  inviters
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold">
                User Credits Strategy 🎮
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm">
                <li>Use rewards as initial credits/tokens in your app</li>
                <li>Let users spend rewards on premium features</li>
                <li>Create a rewards-to-benefits conversion system</li>
                <li>Display user's potential rewards clearly in your UI</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Viral Growth 🚀</h3>
              <ul className="list-disc pl-6 space-y-2 text-sm">
                <li>Make invite links easily shareable across platforms</li>
                <li>Add "Share" buttons in strategic locations</li>
                <li>Show users their earning potential through invites</li>
                <li>Create leaderboards for top inviters</li>
                <li>
                  Consider time-limited referral bonuses for special events
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Technical Tips ⚙️</h3>
              <ul className="list-disc pl-6 space-y-2 text-sm">
                <li>Cache user eligibility status to reduce RPC calls</li>
                <li>Implement proper error handling for failed claims</li>
                <li>Monitor your app's reward usage through events</li>
                <li>Set up alerts for unusual claiming patterns</li>
                <li>Keep your backend signing key secure</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default IntegrationGuide

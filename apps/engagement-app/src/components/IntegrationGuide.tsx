import React, { useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Button } from './ui/button'
import { Check } from 'lucide-react'
import Prism from 'prismjs'
import 'prismjs/themes/prism-tomorrow.css'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-solidity'

// Add these styles to ensure code visibility
const codeBlockStyles = {
  pre: "bg-zinc-950 p-4 rounded-lg overflow-x-auto relative",
  code: "block text-sm text-zinc-50 font-mono",
  copyButton: "absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
}

const CodeBlock: React.FC<{ code: string; language: string }> = ({ code, language }) => {
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

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code)
  }

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
          <h3 className="text-lg font-semibold">Requirements</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your app/smart contract must be registered and approved in the EngagementRewards contract</li>
            <li>Users must have whitelisted status in the Identity contract</li>
            <li>Users can only claim rewards once per cooldown period (180 days)</li>
            <li>Apps have a maximum reward limit that resets every 180 days</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Signatures</CardTitle>
          <CardDescription>Understanding when user signatures are required</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="list-disc pl-6 space-y-2">
            <li>A user signature is required when:
              <ul className="list-disc pl-6 mt-2">
                <li>First time user interacts with your app</li>
                <li>After an app has been re-applied (new registration)</li>
              </ul>
            </li>
            <li>Once registered, subsequent claims don't require signatures</li>
            <li>See client-side integration for how to obtain user signatures</li>
          </ul>
        </CardContent>
      </Card>

      <Tabs defaultValue="smart-contract">
        <TabsList>
          <TabsTrigger value="smart-contract">Smart Contract Integration</TabsTrigger>
          <TabsTrigger value="client">Client-Side Integration</TabsTrigger>
        </TabsList>

        <TabsContent value="smart-contract" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Smart Contract Integration</CardTitle>
              <CardDescription>
                Integrate directly through your smart contract
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">1. Interface Definition</h3>
                <CodeBlock 
                  language="solidity" 
                  code={`interface IEngagementRewards {
    function appClaim(
        address inviter,
        uint256 validUntilBlock,
        bytes memory signature
    ) external returns (bool);

    function appClaim(
        address inviter,
        uint256 validUntilBlock,
        bytes memory signature,
        uint256 userAndInviterPercentage,
        uint256 userPercentage
    ) external returns (bool);
}`} 
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Smart Contract Implementation</h3>
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

    // Example 1: Simple reward claim after winning a game
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
            inviter,
            validUntilBlock,
            signature
        ) returns (bool success) {
            if (!success) {
                emit RewardClaimFailed("Basic claim returned false");
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
        string calldata achievementId,
        uint256[] calldata proof,
        address inviter,
        uint256 validUntilBlock,
        bytes memory signature
    ) external {
        require(_verifyAchievement(achievementId, proof), "Invalid achievement");
        
        // Calculate rewards based on player stats
        uint256 userInviterShare = calculateUserInviterShare(msg.sender);
        uint256 userShare = calculateUserShare(msg.sender);

        try engagementRewards.appClaim(
            inviter,
            validUntilBlock,
            signature,
            userInviterShare,
            userShare
        ) returns (bool success) {
            if (!success) {
                emit RewardClaimFailed("Achievement claim returned false");
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
    function calculateUserInviterShare(address player) internal view returns (uint256) {
        uint256 level = playerLevel[player];
        return 60 + (level * 30) / 100; // Base 60% + up to 30% based on level
    }

    function calculateUserShare(address player) internal view returns (uint256) {
        uint256 wins = gamesWon[player];
        return 70 + (wins * 20) / 100; // Base 70% + up to 20% based on wins
    }

    // Game logic (simplified for example)
    function _verifyGameWin(uint256 score, uint8 difficulty, bytes32 proof) internal pure returns (bool) {
        // Your game verification logic
        return true;
    }

    function _verifyAchievement(string calldata id, uint256[] calldata proof) internal pure returns (bool) {
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

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Important Notes</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Custom reward percentages should be determined by your contract's business logic</li>
                  <li>Never accept percentage values directly from user input</li>
                  <li>Use try/catch to handle errors properly</li>
                  <li>Consider caching successful claims to prevent unnecessary contract calls</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="client" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Client-Side Integration</CardTitle>
              <CardDescription>
                Integrate using the engagement-sdk directly in your dApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">1. SDK Setup</h3>
                <CodeBlock 
                  language="typescript" 
                  code={`import { useEngagementRewards } from '@goodsdks/engagement-sdk'

const MyComponent = () => {
  const engagementRewards = useEngagementRewards(REWARDS_CONTRACT_ADDRESS)
  
  // SDK is ready when hook returns non-null
  if (!engagementRewards) return null
}`} 
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">2. Check Eligibility & Claim</h3>
                <CodeBlock 
                  language="typescript" 
                  code={`const handleClaim = async () => {
  try {
    // First check if user can claim
    const isEligible = await engagementRewards.canClaim(APP_ADDRESS, userAddress)
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
        validUntilBlock,
        "Initial registration claim"
      )
    }

    // Submit claim
    const receipt = await engagementRewards.eoaClaim(
      APP_ADDRESS,
      INVITER_ADDRESS,
      validUntilBlock,
      signature,
      (hash) => console.log("Transaction submitted:", hash)
    )

    if (receipt?.status === "success") {
      console.log("Claim successful")
    }
  } catch (error) {
    if (error.message.includes("Claim cooldown not reached")) {
      console.error("User must wait before claiming again")
    } else if (error.message.includes("User not registered")) {
      console.error("User is not whitelisted")
    } else {
      console.error("Claim failed:", error)
    }
  }
}`} 
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Troubleshooting Checklist</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>User wallet is connected and has sufficient gas</li>
                  <li>App is registered and approved</li>
                  <li>User is whitelisted in Identity contract</li>
                  <li>Cooldown period has elapsed since last claim</li>
                  <li>App hasn't reached maximum rewards</li>
                  <li>Signature hasn't expired (block number hasn't passed)</li>
                  <li>Contract has sufficient reward tokens</li>
                </ul>

                <h3 className="text-lg font-semibold mt-6">Best Practices</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Always check if user can claim before requesting signature</li>
                  <li>Implement proper error handling and user feedback</li>
                  <li>Monitor transaction status and provide feedback</li>
                  <li>Cache claim timestamps to avoid unnecessary transactions</li>
                  <li>Keep validUntilBlock reasonable (5-10 blocks ahead)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default IntegrationGuide

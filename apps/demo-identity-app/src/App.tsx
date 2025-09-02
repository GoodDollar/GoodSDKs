import React, { useEffect, useState } from "react"
import {
  createTamagui,
  TamaguiProvider,
  View,
  Text,
  ScrollView,
  Spinner,
  YStack,
  Anchor,
  Stack,
} from "tamagui"
import { config } from "@tamagui/config/v3"
import { useLocation } from "react-router-dom"
import { useAccount } from "wagmi"
import { useIdentitySDK } from "@goodsdks/react-hooks"
import { handleVerificationResponse, handleVerificationResponseSync, isInFarcasterMiniApp, isInFarcasterMiniAppSync } from "@goodsdks/citizen-sdk"

import { VerifyButton } from "./components/VerifyButton"
import { IdentityCard } from "./components/IdentityCard"
import { SigningModal } from "./components/SigningModal"
import { ClaimButton } from "./components/ClaimButton"
import { sdk } from '@farcaster/miniapp-sdk'

const tamaguiConfig = createTamagui(config)

const App: React.FC = () => {
  const [isSigningModalOpen, setIsSigningModalOpen] = useState(false)
  const [isVerified, setIsVerified] = useState<boolean | undefined>(false)
  const [isWhitelisted, setIsWhitelisted] = useState<boolean | undefined>(
    undefined,
  )
  const [loadingWhitelist, setLoadingWhitelist] = useState<boolean | undefined>(
    undefined,
  )
  const [isFarcasterMode, setIsFarcasterMode] = useState<boolean>(false)

  const location = useLocation()
  const { address, isConnected } = useAccount()
  const [connectedAccount, setConnectedAccount] = useState<string | undefined>(
    undefined,
  )
  const { sdk: identitySDK } = useIdentitySDK("development")

  useEffect(() => {
    // Initialize Farcaster SDK
    const initializeFarcasterSDK = async () => {
      try {
        await sdk.actions.ready()
        console.log('Farcaster SDK initialized successfully')
      } catch (error) {
        console.warn('Failed to initialize Farcaster SDK:', error)
      }
    }

    // Check if running in Farcaster miniapp mode (async)
    const checkFarcasterMode = async () => {
      try {
        const isFarcaster = await isInFarcasterMiniApp()
        setIsFarcasterMode(isFarcaster)
      } catch (error) {
        // Fallback to sync version if async fails
        console.warn('Async Farcaster detection failed, using sync fallback:', error)
        setIsFarcasterMode(isInFarcasterMiniAppSync())
      }
    }
    
    initializeFarcasterSDK()
    checkFarcasterMode()
    
    // Enhanced verification check with on-chain support for popup mode (CBU)
    const checkVerification = async () => {
      try {
        // Use async version for on-chain verification support (needed for popup mode)
        const verificationResult = await handleVerificationResponse(
          undefined, // Use current URL
          address, // Pass wallet address for on-chain verification
          identitySDK?.publicClient, // Pass public client for on-chain checks
          undefined, // Use default chain
          "development" // Use development environment
        )
        
        if (verificationResult.isVerified) {
          setIsVerified(true)
          // Clean up URL parameters
          window.history.replaceState({}, document.title, window.location.pathname)
        }
        
        // Log additional verification parameters for debugging
        if (verificationResult.params.size > 0) {
          console.log("Verification response parameters:", Object.fromEntries(verificationResult.params))
        }
        
        // Log on-chain verification status for debugging
        if (verificationResult.onChainVerified !== undefined) {
          console.log("On-chain verification status:", verificationResult.onChainVerified)
        }
      } catch (error) {
        console.warn("Verification check failed:", error)
        // Fallback to sync version if async fails
        const syncResult = handleVerificationResponseSync()
        if (syncResult.isVerified) {
          setIsVerified(true)
          window.history.replaceState({}, document.title, window.location.pathname)
        }
      }
    }
    
    checkVerification()
  }, [location.search, address, identitySDK])

  //ref: https://github.com/wevm/wagmi/discussions/1806#discussioncomment-12130996
  // does not react to switch account when triggered from metamask.
  // useAccountEffect({
  //   onConnect(data) {
  //     console.log("Connected!", data)
  //   },
  //   onDisconnect() {
  //     console.log("Disconnected!")
  //   },
  // })

  useEffect(() => {
    const checkWhitelistStatus = async () => {
      if (address && isWhitelisted === undefined) {
        try {
          setLoadingWhitelist(true)
          setConnectedAccount(address)
          const { isWhitelisted } =
            (await identitySDK?.getWhitelistedRoot(address)) ?? {}

          setIsWhitelisted(isWhitelisted)
          setIsVerified(isWhitelisted ?? false)
        } catch (error) {
          console.error("Error checking whitelist:", error)
        } finally {
          setLoadingWhitelist(false)
        }
      }
    }

    if (address !== connectedAccount || !address) {
      setConnectedAccount(address)
      setIsWhitelisted(undefined)
      setIsVerified(undefined)
      checkWhitelistStatus()
    }
  }, [address, identitySDK])

  const handleVerificationSuccess = () => {
    setIsVerified(true)
  }

  return (
    <TamaguiProvider config={tamaguiConfig}>
      <ScrollView
        flex={1}
        padding={24}
        backgroundColor="#F7FAFC"
        alignItems="center"
      >
        <YStack maxWidth={600} width="100%" alignItems="center">
          <Text
            fontSize={26}
            fontWeight="bold"
            color="$text"
            textAlign="center"
          >
            GoodDollar Identity Verification
          </Text>
          
          {isFarcasterMode && (
            <YStack
              padding="$2"
              backgroundColor="#E3F2FD"
              borderRadius="$3"
              borderWidth={1}
              borderColor="#2196F3"
              marginVertical={8}
            >
              <Text fontSize={12} color="#1976D2" textAlign="center" fontWeight="bold">
                Farcaster MiniApp Mode Detected
              </Text>
              
            </YStack>
          )}

          {/* Disclaimer Section */}
          <YStack
            padding="$3"
            backgroundColor="#FFF8E1"
            borderRadius="$4"
            borderWidth={1}
            borderColor="#FFD700"
            marginVertical={16}
          >
            <Text fontSize={14} color="#664D03" textAlign="center">
              <Text fontWeight="bold">Disclaimer: </Text>
              This is a demo showing how to integrate a uniquely identified user
              into your dApp using the GoodDollar protocol's Identity. This demo
              uses the development contract.{" "}
              <Anchor
                href="https://github.com/GoodDollar/GoodSdks"
                color="#005AFF"
                target="_blank"
              >
                Learn more about the sdk and how to integrate it here.
              </Anchor>
            </Text>
          </YStack>

          {/* User Interaction Section */}
          <View
            padding="$3"
            backgroundColor="white"
            borderRadius="$4"
            borderWidth={1}
            borderColor="#E2E8F0"
            width="100%"
            alignItems="center"
            justifyContent="center"
          >
            <Stack
              justifyContent="center"
              alignItems="center"
              marginBottom={16}
            >
              {!isConnected ? (
                <>
                  <Text fontSize={16} color="$red10" marginBottom={16}>
                    Please connect your wallet to proceed.
                  </Text>
                </>
              ) : null}
              <appkit-button></appkit-button>
            </Stack>

            {isConnected && loadingWhitelist ? <Spinner size="large" /> : null}

            {isConnected &&
              !loadingWhitelist &&
              (isVerified || isWhitelisted) && (
                <YStack alignItems="center">
                  <IdentityCard />
                  <Text marginTop={16} fontSize={16} color="$green10">
                    You are successfully verified and/or whitelisted.
                  </Text>
                </YStack>
              )}

            {isConnected &&
            !loadingWhitelist &&
            !isVerified &&
            !isWhitelisted ? (
              <YStack alignItems="center" gap={12}>
                <VerifyButton
                  onVerificationSuccess={handleVerificationSuccess}
                />
                <Text fontSize={14} color="$gray10">
                  You need to verify your identity via GoodDollar to continue.
                </Text>
              </YStack>
            ) : null}
          </View>

          {/* Help Section */}
          <YStack justifyContent="center" alignItems="center" marginTop={24}>
            <Text fontSize={14} color="$gray10">
              Need help? Visit our docs:{" "}
              <Anchor
                href="https://docs.gooddollar.org"
                target="_blank"
                color="#005AFF"
              >
                GoodDollar Docs
              </Anchor>
              .
            </Text>
            <Text fontSize={14} color="$gray10">
              Or join our Developer Communities at:{" "}
              <Anchor
                href="https://ubi.gd/GoodBuildersDiscord"
                target="_blank"
                color="#005AFF"
              >
                GoodBuilders Discord
              </Anchor>
              .
            </Text>
          </YStack>
        </YStack>

        {/* Claim UBI Section */}
        <YStack
          padding="$4"
          backgroundColor="white"
          borderRadius="$4"
          borderWidth={1}
          borderColor="#E2E8F0"
          width="100%"
          maxWidth={600}
          alignItems="center"
          justifyContent="center"
          marginTop={24}
          shadow="$1"
        >
          <Text
            fontSize={18}
            fontWeight="bold"
            color="$text"
            marginBottom={12}
            textAlign="center"
          >
            Claim Your Daily UBI
          </Text>
          {isConnected ? (
            <ClaimButton />
          ) : (
            <>
              <Text
                fontSize={14}
                color="$red10"
                textAlign="center"
                marginBottom={12}
              >
                Please connect your wallet to claim your UBI.
              </Text>
              <appkit-button></appkit-button>
            </>
          )}
        </YStack>

        <SigningModal
          open={isSigningModalOpen}
          onClose={() => setIsSigningModalOpen(false)}
        />
      </ScrollView>
    </TamaguiProvider>
  )
}

export default App
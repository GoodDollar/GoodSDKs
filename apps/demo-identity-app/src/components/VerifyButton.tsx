import React from "react"
import { Button } from "tamagui"
import { useIdentitySDK } from "@goodsdks/react-hooks"
import { useAccount } from "wagmi"

import { isInFarcasterMiniApp } from "@goodsdks/citizen-sdk"
import { FARCASTER_CONFIG } from "../App"

interface VerifyButtonProps {
  onVerificationSuccess: () => void
}

export const VerifyButton: React.FC<VerifyButtonProps> = ({
  onVerificationSuccess,
}) => {
  const { address } = useAccount()
  const { sdk: identitySDK } = useIdentitySDK("development")

  const handleVerify = async () => {
    if (!identitySDK || !address) return

    try {
      let callbackUrl = window.location.href

      const isFarcaster = await isInFarcasterMiniApp()
      if (isFarcaster) {
        callbackUrl = identitySDK.generateFarcasterCallback(FARCASTER_CONFIG)
      }

      await identitySDK.navigateToFaceVerification(callbackUrl, 42220)
    } catch (error) {
      console.error("Verification failed:", error)
    }
  }

  return (
    <Button
      onPress={handleVerify}
      color="white"
      backgroundColor="#00AEFF"
      hoverStyle={{
        backgroundColor: "black",
      }}
    >
      Verify Me
    </Button>
  )
}

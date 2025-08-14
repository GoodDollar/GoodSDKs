import React from "react"
import { Button } from "tamagui"
import { useIdentitySDK } from "@goodsdks/react-hooks"
import { useAccount } from "wagmi"

interface VerifyButtonProps {
  onVerificationSuccess?: () => void
}

export const VerifyButton: React.FC<VerifyButtonProps> = ({
  onVerificationSuccess,
}) => {
  const { address } = useAccount()
  const { sdk: identitySDK } = useIdentitySDK("development")

  const handleVerify = async () => {
    if (!identitySDK || !address) return

    try {
      // Use the new navigation method that automatically handles Farcaster miniapps
      await identitySDK.navigateToFaceVerification(
        false,
        window.location.href,
        42220
      )
    } catch (error) {
      console.error("Verification failed:", error)
      // Handle error (e.g., show toast)
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
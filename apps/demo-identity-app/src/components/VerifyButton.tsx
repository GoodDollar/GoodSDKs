import React, { useState } from "react"
import { Button, Spinner } from "tamagui"
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
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleVerify = async () => {
    if (!identitySDK || !address) return

    setIsLoading(true)
    setError(null)

    try {
      // Force popup mode for better Farcaster compatibility
      await identitySDK.navigateToFaceVerification(
        true, // Force popup mode
        window.location.href,
        42220
      )
      onVerificationSuccess?.()
    } catch (error: any) {
      console.error("Verification failed:", error)
      setError(error.message || "Verification failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <Button
        onPress={handleVerify}
        disabled={isLoading}
        color="white"
        backgroundColor="#00AEFF"
        hoverStyle={{
          backgroundColor: "black",
        }}
      >
        {isLoading ? <Spinner size="small" color="white" /> : "Verify Me"}
      </Button>
      {error && (
        <div style={{ color: "red", fontSize: "14px", marginTop: "8px" }}>
          {error}
        </div>
      )}
    </div>
  )
}
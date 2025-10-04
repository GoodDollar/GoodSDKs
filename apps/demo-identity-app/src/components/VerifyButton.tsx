import React, { useState } from "react"
import { Button, Spinner } from "tamagui"
import { useIdentitySDK } from "@goodsdks/react-hooks"
import { useAccount } from "wagmi"

interface VerifyButtonProps {
  // No props needed - verification success is handled by URL callback detection
}

export const VerifyButton: React.FC<VerifyButtonProps> = () => {
  const { address } = useAccount()
  const { sdk: identitySDK } = useIdentitySDK("development")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleVerify = async () => {
    if (!identitySDK || !address) {
      setError("Wallet not connected. Please connect your wallet first.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log("Starting face verification process...")
      console.log("Address:", address)
      console.log("Callback URL:", window.location.href)
      
      // Navigate to face verification - this will open in external browser in Farcaster
      await identitySDK.navigateToFaceVerification(
        false, // Use redirect mode for proper callback handling
        window.location.href,
        42220
      )
      
      console.log("Face verification navigation initiated successfully")
      // Note: Verification success will be handled by URL callback detection in App.tsx
      // when the user returns from the external verification process
      
    } catch (error: any) {
      console.error("Face verification navigation failed:", error)
      
      // Provide specific error messages based on error type
      if (error.message?.includes("Navigation not supported")) {
        setError("Navigation is not supported in this environment. Please try in a different browser.")
      } else if (error.message?.includes("openUrl")) {
        setError("Failed to open verification page. Please check your browser settings and try again.")
      } else if (error.message?.includes("signature")) {
        setError("Failed to sign verification message. Please try again.")
      } else {
        setError(error.message || "Verification failed. Please try again.")
      }
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
import React from "react"
import { Button } from "tamagui"
import { useIdentitySDK } from "@goodsdks/react-hooks"
import { useAccount } from "wagmi"

export const VerifyButton: React.FC = () => {
  const { address } = useAccount()
  const { sdk: identitySDK } = useIdentitySDK("development")

  const handleVerify = async () => {
    if (!identitySDK || !address) return

    try {
      const fvLink = await identitySDK.generateFVLink(
        false,
        window.location.href,
        42220,
      )

      window.location.href = fvLink
    } catch (error) {
      // generateFVLink throws errors that should be handled by the caller
      // Re-throw to allow parent components to handle the error appropriately
      throw error
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

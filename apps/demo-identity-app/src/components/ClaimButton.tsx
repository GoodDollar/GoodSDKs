import React, { useCallback, useEffect, useState } from "react"
import { Button, Text, XStack, YStack, Spacer } from "tamagui"
import { ClaimSDK, useClaimSDK } from "@goodsdks/citizen-sdk" // Adjust the import path as needed
import { useAccount } from "wagmi"

export const ClaimButton: React.FC = () => {
  const { address } = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [sdk, setSdk] = useState<ClaimSDK | null>(null)
  const claimSDK = useClaimSDK("development")
  const [claimAmount, setClaimAmount] = useState<Number | null>(null)

  // Initialize ClaimSDK on component mount
  useEffect(() => {
    const initializeSDK = async () => {
      const sdk = await claimSDK?.()
      console.log("ClaimSDK initialized:", { sdk })
      if (!sdk) return

      const amount = await sdk.checkEntitlement()
      const claimAmount = Number(amount) / 1e18
      const result = Math.round((claimAmount + Number.EPSILON) * 100) / 100

      setClaimAmount(result)

      setSdk(sdk)
    }
    if (!sdk) {
      initializeSDK()
    }
  }, [address, claimSDK])

  const handleClaim = useCallback(async () => {
    if (!sdk) {
      setError("ClaimSDK is not initialized.")
      return
    }

    setIsLoading(true)
    setError(null)
    setTxHash(null)

    try {
      const tx = await sdk.claim()
      if (!tx) return

      setTxHash(tx.transactionHash)
    } catch (err: any) {
      console.error("Claim failed:", err)
      setError(err.message || "An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }, [sdk])

  return (
    <YStack alignItems="center" gap="$4" padding="$4">
      <Button
        onPress={handleClaim}
        color="$colorWhite"
        backgroundColor={isLoading ? "$colorGray500" : "$colorGreen500"}
        disabled={isLoading || !address || claimAmount === 0}
        hoverStyle={{
          backgroundColor: isLoading ? "$colorGray600" : "$colorGreen600",
        }}
        pressedStyle={{
          backgroundColor: isLoading ? "$colorGray700" : "$colorGreen700",
        }}
        borderRadius="$4"
        paddingHorizontal="$6"
        paddingVertical="$3"
        opacity={isLoading || !address ? 0.7 : 1}
      >
        {isLoading
          ? "Claiming..."
          : claimAmount !== 0
            ? `Claim UBI ${claimAmount}`
            : "Come back tomorrow to claim your UBI!"}
      </Button>

      {txHash && (
        <XStack alignItems="center">
          <Text color="$colorGreen600" fontSize="$3">
            Transaction sent:
          </Text>
          <Spacer />
          <Text
            color="$colorBlue600"
            fontSize="$3"
            textDecoration="underline"
            cursor="pointer"
            onPress={() =>
              window.open(`https://celoscan.io/tx/${txHash}`, "_blank")
            }
          >
            {txHash.slice(0, 6)}...{txHash.slice(-4)}
          </Text>
        </XStack>
      )}

      {error && (
        <Text color="$colorRed600" fontSize="$3">
          Error: {error}
        </Text>
      )}
    </YStack>
  )
}

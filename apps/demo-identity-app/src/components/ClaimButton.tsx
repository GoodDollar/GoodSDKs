import React, { useCallback, useEffect, useState } from "react"
import { Button, Text, XStack, YStack, Spacer } from "tamagui"
import { useClaimSDK } from "@goodsdks/react-hooks"
import {
  chainConfigs,
  CHAIN_DECIMALS,
  isSupportedChain,
  SupportedChains,
} from "@goodsdks/citizen-sdk"
import { formatUnits } from "viem"
import { useAccount } from "wagmi"

export const ClaimButton: React.FC = () => {
  const { address, chainId } = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const { sdk: claimSDK, loading, error: sdkError } = useClaimSDK("development")
  const [sdk, setSdk] = useState<typeof claimSDK | null>(null)
  const [claimAmount, setClaimAmount] = useState<Number | null>(null)
  const [altClaimAvailable, setAltClaimAvailable] = useState(false)
  const [altChainId, setAltChainId] = useState<SupportedChains | null>(null)

  // Initialize ClaimSDK on component mount

  useEffect(() => {
    setSdk(null)
    setError(null)
  }, [chainId, loading])

  useEffect(() => {
    const initializeSDK = async () => {
      const sdk = claimSDK
      if (!sdk || !chainId) return
      setIsLoading(true)

      try {
        if (!isSupportedChain(chainId)) {
          throw new Error(`Unsupported chain id: ${chainId}`)
        }

        const { amount, altClaimAvailable, altChainId } =
          await sdk.checkEntitlement()

        const decimals = CHAIN_DECIMALS[chainId as SupportedChains]

        const formattedAmount = formatUnits(amount, decimals)
        const rounded =
          Math.round((Number(formattedAmount) + Number.EPSILON) * 100) / 100

        setClaimAmount(rounded)
        setAltClaimAvailable(altClaimAvailable)
        setAltChainId(altClaimAvailable ? (altChainId ?? null) : null)
        setSdk(sdk)
      } catch (err: any) {
        setError(err.message || "Failed to fetch entitlement.")
      } finally {
        setIsLoading(false)
      }
    }

    if (sdkError) {
      setError(sdkError)
    } else if (!sdk && !loading) {
      initializeSDK()
    }
  }, [address, claimAmount, claimSDK, loading, chainId])

  const handleClaim = useCallback(async () => {
    if (!sdk) {
      setError("ClaimSDK is not initialized.")
      return
    }

    setIsClaiming(true)
    setError(null)
    setTxHash(null)

    try {
      const txConfirm = async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }

      const tx = await sdk.claim(txConfirm)
      if (!tx) return

      setTxHash(tx.transactionHash)
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.")
    } finally {
      setIsClaiming(false)
      setClaimAmount(null)
    }
  }, [sdk, claimAmount, chainId])

  return (
    <YStack alignItems="center" gap="$4" padding="$4">
      {!error && (
        <Button
          onPress={handleClaim}
          color="$colorWhite"
          backgroundColor={isClaiming ? "$colorGray500" : "$colorGreen500"}
          disabled={isClaiming || !address || claimAmount === 0}
          hoverStyle={{
            backgroundColor: isClaiming ? "$colorGray600" : "$colorGreen600",
          }}
          pressedStyle={{
            backgroundColor: isClaiming ? "$colorGray700" : "$colorGreen700",
          }}
          borderRadius="$4"
          paddingHorizontal="$6"
          paddingVertical="$3"
          opacity={isLoading || !address ? 0.7 : 1}
        >
          {isLoading
            ? "Loading..."
            : isClaiming
              ? "Claiming..."
              : claimAmount !== 0
                ? `Claim UBI ${claimAmount}`
                : altClaimAvailable && altChainId
                  ? `Claim available on ${chainConfigs[altChainId].label}`
                  : "Come back tomorrow to claim your UBI!"}
        </Button>
      )}

      {claimAmount === 0 && altClaimAvailable && altChainId && (
        <Text color="$colorBlue600" fontSize="$3">
          Switch to {chainConfigs[altChainId].label} to claim your UBI today.
        </Text>
      )}

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
            onPress={() => {
              let explorerUrl = `https://celoscan.io/tx/${txHash}`

              if (chainId && isSupportedChain(chainId)) {
                explorerUrl = chainConfigs[chainId].explorer.tx(txHash)
              }

              window.open(explorerUrl, "_blank")
            }}
          >
            {txHash.slice(0, 6)}...{txHash.slice(-4)}
          </Text>
        </XStack>
      )}

      {(error || sdkError) && (
        <Text color="$red10" fontSize="$3">
          Error: {error ?? sdkError}
        </Text>
      )}
    </YStack>
  )
}

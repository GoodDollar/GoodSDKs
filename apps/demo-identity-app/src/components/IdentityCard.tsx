import React, { useEffect, useState } from "react"
import { View, Text, Spinner } from "tamagui"
import { useIdentitySDK } from "@goodsdks/react-hooks"
import { useAccount } from "wagmi"

export const IdentityCard: React.FC = () => {
  const { address } = useAccount()
  const { sdk: identitySDK, loading, error } = useIdentitySDK("development")
  const [expiry, setExpiry] = useState<string | undefined>(undefined)
  const [isWhitelisted, setIsWhitelisted] = useState<boolean | undefined>(undefined)
  const [rootAddress, setRootAddress] = useState<string | undefined>(undefined)

  useEffect(() => {
    const fetchIdentityData = async () => {
      if (!identitySDK || !address) return

      try {
        const { isWhitelisted: whitelisted, root } =
          await identitySDK.getWhitelistedRoot(address)

        setIsWhitelisted(whitelisted)
        setRootAddress(root)

        if (whitelisted) {
          const identityExpiry = await identitySDK.getIdentityExpiryData(root as `0x${string}`)

          const { expiryTimestamp } = identitySDK.calculateIdentityExpiry(
            identityExpiry?.lastAuthenticated ?? BigInt(0),
            identityExpiry?.authPeriod ?? BigInt(0),
          )

          const date = new Date(Number(expiryTimestamp))
          const formattedExpiryTimestamp = date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "2-digit",
          })

          setExpiry(formattedExpiryTimestamp)
        } else {
          setExpiry(undefined)
        }
      } catch (err) {
        console.error("fetchIdentityData error:", err)
      }
    }

    if (identitySDK) {
      fetchIdentityData()
    }
  }, [address, identitySDK])

  if (!address) return null

  return (
    <View
      width="350px"
      backgroundColor="$background"
      padding="40px"
      borderRadius="$small"
      shadowOpacity={0.2}
    >
      {loading ? (
        <Spinner size="large" color="$primary" />
      ) : error ? (
        <Text>{error}</Text>
      ) : (
        <>
          <Text color="$text" fontSize="$medium" mb="$small">
            Connected Wallet: {address.slice(0, 6)}...{address.slice(-4)}
          </Text>
          {isWhitelisted && rootAddress && rootAddress.toLowerCase() !== address.toLowerCase() && (
            <Text color="$text" fontSize="$medium" mb="$small">
              Root Identity: {rootAddress.slice(0, 6)}...{rootAddress.slice(-4)}
            </Text>
          )}
          <Text color="$text" fontSize="$medium">
            Status: {isWhitelisted ? "Whitelisted" : "Not Whitelisted"}
          </Text>
          {isWhitelisted && expiry && (
            <Text color="$text" fontSize="$medium" mt="$small">
              {new Date(expiry) < new Date() ? "Expired" : "Expiry"}: {expiry}
            </Text>
          )}
        </>
      )}
    </View>
  )
}

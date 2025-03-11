import React, { useEffect, useState } from "react"
import { View, Text } from "tamagui"
import { useIdentitySDK } from "@goodsdks/identity-sdk"
import { useAccount } from "wagmi"

export const IdentityCard: React.FC = () => {
  const { address } = useAccount()
  const identitySDK = useIdentitySDK("development")
  const [expiry, setExpiry] = useState<string | undefined>(undefined)

  useEffect(() => {
    const fetchExpiry = async () => {
      if (!identitySDK || !address) return

      const identityExpiry = await identitySDK.getIdentityExpiryData(address)

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

      if (formattedExpiryTimestamp) {
        setExpiry(formattedExpiryTimestamp)
      }
    }

    fetchExpiry()
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
      <Text color="$text" fontSize="$medium" mb="$small">
        Wallet Address: {address}
      </Text>
      <Text color="$text" fontSize="$medium">
        {expiry && new Date(expiry) < new Date() ? "Expired" : "Expiry"}:{" "}
        {expiry || "Not Verified"}
      </Text>
    </View>
  )
}

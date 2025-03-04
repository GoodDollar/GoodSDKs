import React, { useEffect, useState } from "react";
import { View, Text } from "tamagui";
import { useIdentitySDK } from "@goodsdks/identity-sdk";
import { useAccount } from "wagmi";

interface IdentityCardProps {
  contractAddress: any;
}

export const IdentityCard: React.FC<IdentityCardProps> = ({
  contractAddress,
}) => {
  const { address } = useAccount();
  const identitySDK = useIdentitySDK(contractAddress);
  const [expiry, setExpiry] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchExpiry = async () => {
      if (address) {
        const identityExpiry = await identitySDK.getIdentityExpiry(address);
        if (identityExpiry?.formattedExpiryTimestamp) {
          setExpiry(identityExpiry.formattedExpiryTimestamp);
        }
      }
    };

    fetchExpiry();
  }, [address, identitySDK]);

  if (!address) return null;

  return (
    <View
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
  );
};

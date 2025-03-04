import React from "react";
import { Button } from "tamagui";
import { useIdentitySDK } from "@goodsdks/identity-sdk"; // Adjust the import path as needed
import { useAccount } from "wagmi";

interface VerifyButtonProps {
  onVerificationSuccess: () => void;
}

export const VerifyButton: React.FC<VerifyButtonProps> = ({
  onVerificationSuccess,
}) => {
  const { address } = useAccount();
  const identitySDK = useIdentitySDK(
    "0xF25fA0D4896271228193E782831F6f3CFCcF169C",
  );

  const handleVerify = async () => {
    if (!address) return;

    try {
      const fvLink = await identitySDK.generateFVLink(
        window.location.href,
        false,
        42220,
      );

      window.location.href = fvLink;
    } catch (error) {
      console.error("Verification failed:", error);
      // Handle error (e.g., show toast)
    }
  };

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
  );
};

import React, { useEffect, useState } from "react";
import {
  createTamagui,
  TamaguiProvider,
  View,
  Text,
  ScrollView,
} from "tamagui";
import { config } from "@tamagui/config/v3";
import { useLocation } from "react-router-dom";
import { useAccount } from "wagmi";

import { VerifyButton } from "./components/VerifyButton";
import { IdentityCard } from "./components/IdentityCard";
import { SigningModal } from "./components/SigningModal";
import { useIdentitySDK } from "@goodsdks/identity-sdk";

const tamaguiConfig = createTamagui(config);

const CONTRACT_ADDRESS = "0xF25fA0D4896271228193E782831F6f3CFCcF169C";

const App: React.FC = () => {
  const [isSigningModalOpen, setIsSigningModalOpen] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const location = useLocation();
  const { address } = useAccount();
  const identitySDK = useIdentitySDK(CONTRACT_ADDRESS);

  useEffect(() => {
    // Check if returning from FV link with success
    const urlParams = new URLSearchParams(location.search);
    const verified = urlParams.get("verified");

    if (verified === "true") {
      setIsVerified(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location.search]);

  useEffect(() => {
    const checkWhitelistStatus = async () => {
      if (address) {
        try {
          const whitelisted = await identitySDK.checkIsWhitelisted(address);
          setIsWhitelisted(whitelisted);
        } catch (error) {
          console.error("Error checking if whitelisted:", error);
        }
      }
    };

    checkWhitelistStatus();
  }, [address, identitySDK]);

  const handleVerificationSuccess = () => {
    setIsVerified(true);
  };

  return (
    <TamaguiProvider config={tamaguiConfig}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: 16,
          backgroundColor: "#f0f0f0",
        }}
      >
        <View alignItems="center" marginBottom={24}>
          <Text fontSize={24} color="$text" marginBottom={16}>
            GoodDollar Identity Verification
          </Text>
          <appkit-button></appkit-button>
        </View>

        <View alignItems="center" marginBottom={24}>
          {!isWhitelisted && !isVerified && address ? (
            <VerifyButton onVerificationSuccess={handleVerificationSuccess} />
          ) : null}
        </View>

        {isWhitelisted || isVerified ? (
          <IdentityCard contractAddress={CONTRACT_ADDRESS} />
        ) : null}

        <SigningModal
          open={isSigningModalOpen}
          onClose={() => setIsSigningModalOpen(false)}
        />
      </ScrollView>
    </TamaguiProvider>
  );
};

export default App;

import React, { useEffect, useState } from "react";
import {
  createTamagui,
  TamaguiProvider,
  View,
  Text,
  ScrollView,
  Spinner,
  YStack,
  Anchor,
  Stack,
} from "tamagui";
import { config } from "@tamagui/config/v3";
import { useLocation } from "react-router-dom";
import { useAccount } from "wagmi";
import { useIdentitySDK } from "@goodsdks/identity-sdk";

import { VerifyButton } from "./components/VerifyButton";
import { IdentityCard } from "./components/IdentityCard";
import { SigningModal } from "./components/SigningModal";

const tamaguiConfig = createTamagui(config);

const App: React.FC = () => {
  const [isSigningModalOpen, setIsSigningModalOpen] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isWhitelisted, setIsWhitelisted] = useState<boolean | undefined>(
    undefined,
  );
  const [loadingWhitelist, setLoadingWhitelist] = useState(false);

  const location = useLocation();
  const { address, isConnected } = useAccount();
  const identitySDK = useIdentitySDK("development");

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const verified = urlParams.get("verified");

    if (verified === "true") {
      setIsVerified(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location.search]);

  useEffect(() => {
    const checkWhitelistStatus = async () => {
      if (address && isWhitelisted === undefined) {
        setLoadingWhitelist(true);
        try {
          const { isWhitelisted } =
            await identitySDK.checkIsWhitelisted(address);
          setIsWhitelisted(isWhitelisted);
        } catch (error) {
          console.error("Error checking whitelist:", error);
        } finally {
          setLoadingWhitelist(false);
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
        flex={1}
        padding={24}
        backgroundColor="#F7FAFC"
        alignItems="center"
      >
        <YStack maxWidth={600} width="100%" alignItems="center">
          <Text
            fontSize={26}
            fontWeight="bold"
            color="$text"
            textAlign="center"
          >
            GoodDollar Identity Verification
          </Text>

          {/* Disclaimer Section */}
          <YStack
            padding="$3"
            backgroundColor="#FFF8E1"
            borderRadius="$4"
            borderWidth={1}
            borderColor="#FFD700"
            marginVertical={16}
          >
            <Text fontSize={14} color="#664D03" textAlign="center">
              <Text fontWeight="bold">Disclaimer: </Text>
              This is a demo showing how to integrate a uniquely identified user
              into your dApp using the GoodDollar protocol's Identity. This demo
              uses the development contract.{" "}
              <Anchor
                href="https://github.com/GoodDollar/GoodSdks"
                color="#005AFF"
                target="_blank"
              >
                Learn more about the sdk and how to integrate it here.
              </Anchor>
            </Text>
          </YStack>

          {/* User Interaction Section */}
          <View
            padding="$3"
            backgroundColor="white"
            borderRadius="$4"
            borderWidth={1}
            borderColor="#E2E8F0"
            width="100%"
            alignItems="center"
            justifyContent="center"
          >
            {!isConnected ? (
              <Stack justifyContent="center" alignItems="center">
                <Text fontSize={16} color="$red10" marginBottom={16}>
                  Please connect your wallet to proceed.
                </Text>
                <appkit-button></appkit-button>
              </Stack>
            ) : null}

            {isConnected && loadingWhitelist ? <Spinner size="large" /> : null}

            {isConnected &&
              !loadingWhitelist &&
              (isVerified || isWhitelisted) && (
                <YStack alignItems="center">
                  <IdentityCard />
                  <Text marginTop={16} fontSize={16} color="$green10">
                    You are successfully verified and/or whitelisted.
                  </Text>
                </YStack>
              )}

            {isConnected &&
            !loadingWhitelist &&
            !isVerified &&
            !isWhitelisted ? (
              <YStack alignItems="center" gap={12}>
                <VerifyButton
                  onVerificationSuccess={handleVerificationSuccess}
                />
                <Text fontSize={14} color="$gray10">
                  You need to verify your identity via GoodDollar to continue.
                </Text>
              </YStack>
            ) : null}
          </View>

          {/* Help Section */}
          <YStack justifyContent="center" alignItems="center" marginTop={24}>
            <Text fontSize={14} color="$gray10">
              Need help? Visit our docs:{" "}
              <Anchor
                href="https://docs.gooddollar.org"
                target="_blank"
                color="#005AFF"
              >
                GoodDollar Docs
              </Anchor>
              .
            </Text>
            <Text fontSize={14} color="$gray10">
              Or join our Developer Communities at:{" "}
              <Anchor
                href="https://ubi.gd/GoodBuildersDiscord"
                target="_blank"
                color="#005AFF"
              >
                GoodBuilders Discord
              </Anchor>
              .
            </Text>
          </YStack>
        </YStack>

        <SigningModal
          open={isSigningModalOpen}
          onClose={() => setIsSigningModalOpen(false)}
        />
      </ScrollView>
    </TamaguiProvider>
  );
};

export default App;

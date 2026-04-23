import React, { useEffect, useState } from "react"
import {
  createTamagui,
  TamaguiProvider,
  View,
  Text,
  ScrollView,
  YStack,
  Anchor,
  Stack,
} from "tamagui"
import { config } from "@tamagui/config/v3"
import { useAppKit } from "@reown/appkit/react"
import { celo } from "wagmi/chains"
import { useAccount, useChainId, useSwitchChain } from "wagmi"

import { LiquidityWidget } from "./components/LiquidityWidget"

const tamaguiConfig = createTamagui(config)

const App: React.FC = () => {
  const { open } = useAppKit()
  const { address, isConnected, connector } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  const [provider, setProvider] = useState<unknown | null>(null)

  // Pull the EIP-1193 provider off the active connector.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!isConnected || !connector) {
        setProvider(null)
        return
      }
      const p = await connector.getProvider()
      if (!cancelled) setProvider(p)
    })()
    return () => {
      cancelled = true
    }
  }, [isConnected, connector, address])

  // The G$/USDGLO pool is on Celo, so keep the user there.
  useEffect(() => {
    if (isConnected && chainId !== celo.id) {
      switchChain({ chainId: celo.id })
    }
  }, [isConnected, chainId, switchChain])

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
            GoodDollar Liquidity Widget
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
              This is a demo showing how to embed the{" "}
              <Text fontFamily="$mono">{`<gooddollar-liquidity-widget>`}</Text>{" "}
              web component in a React app. It provides liquidity to the
              G$/USDGLO pool on Celo.{" "}
              <Anchor
                href="https://github.com/GoodDollar/GoodSdks"
                color="#005AFF"
                target="_blank"
              >
                Learn more about the SDK and how to integrate it here.
              </Anchor>
            </Text>
          </YStack>

          {/* Connect Section */}
          <View
            padding="$3"
            backgroundColor="white"
            borderRadius="$4"
            borderWidth={1}
            borderColor="#E2E8F0"
            width="100%"
            alignItems="center"
            justifyContent="center"
            marginBottom={16}
          >
            <Stack
              justifyContent="center"
              alignItems="center"
              marginBottom={!isConnected ? 12 : 0}
            >
              {!isConnected ? (
                <Text fontSize={16} color="$red10" marginBottom={12}>
                  Connect your wallet to add liquidity.
                </Text>
              ) : null}
              <appkit-button></appkit-button>
            </Stack>
          </View>

          {/* Liquidity Widget */}
          <View width="100%" alignItems="center">
            <LiquidityWidget
              web3Provider={provider}
              connectWallet={() => open()}
              defaultRange="full"
              showPositions
              onTxSubmitted={({ hash, step }) =>
                console.log("[lw] submitted", step, hash)
              }
              onTxConfirmed={({ hash, step }) =>
                console.log("[lw] confirmed", step, hash)
              }
              onTxFailed={({ hash, step, error }) =>
                console.warn("[lw] failed", step, hash, error)
              }
              onPositionAdded={({ hash }) =>
                console.log("[lw] position minted", hash)
              }
              theme={{ primaryColor: "#00BB7F", borderRadius: "16px" }}
            />
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
      </ScrollView>
    </TamaguiProvider>
  )
}

export default App

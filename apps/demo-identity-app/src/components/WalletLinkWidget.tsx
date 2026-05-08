import { useState } from "react"
import { Button, Input, Text, XStack, YStack } from "tamagui"
import { useChainId } from "wagmi"
import { useWalletLink } from "@goodsdks/react-hooks"
import { Address, isAddress } from "viem"
import { SDK_ENV } from "../config"

export const WalletLinkWidget = () => {
  const [targetAddress, setTargetAddress] = useState("")
  const [addressError, setAddressError] = useState<string | null>(null)
  const [activeAction, setActiveAction] = useState<
    "connect" | "disconnect" | null
  >(null)
  const currentChainId = useChainId()
  const parsedAddress = isAddress(targetAddress)
    ? (targetAddress as Address)
    : undefined

  const { actions, connectedStatus } = useWalletLink(
    SDK_ENV,
    parsedAddress,
  )

  const currentChainStatus = connectedStatus.statuses.find(
    (status) => status.chainId === currentChainId,
  )
  const isConnecting = activeAction === "connect" && actions.loading
  const isDisconnecting = activeAction === "disconnect" && actions.loading

  const handleAddressChange = (value: string) => {
    setTargetAddress(value)
    if (addressError) setAddressError(null)
  }

  const getValidatedAddress = (): Address | null => {
    if (!parsedAddress) {
      setAddressError("Invalid Ethereum address format.")
      return null
    }

    setAddressError(null)
    return parsedAddress
  }

  const handleConnect = async () => {
    const address = getValidatedAddress()
    if (!address) return

    setActiveAction("connect")
    try {
      await actions.connect(address)
    } finally {
      connectedStatus.refetch()
      setActiveAction(null)
    }
  }

  const handleDisconnect = async () => {
    const address = getValidatedAddress()
    if (!address) return

    setActiveAction("disconnect")
    try {
      await actions.disconnect(address)
    } finally {
      connectedStatus.refetch()
      setActiveAction(null)
    }
  }

  const handleCheckStatus = () => {
    if (!getValidatedAddress()) return

    connectedStatus.refetch()
  }

  if (
    actions.pendingSecurityConfirm
  ) {
    const pending = actions.pendingSecurityConfirm

    return (
      <YStack
        padding="$4"
        backgroundColor="#FFF8E1"
        borderRadius="$4"
        borderWidth={1}
        borderColor="#FFD700"
        gap="$3"
      >
        <Text fontSize={18} fontWeight="bold" color="#664D03">
          Security Notice
        </Text>
        <Text fontSize={12} color="#664D03" whiteSpace="pre-wrap">
          {pending.message}
        </Text>
        <XStack gap="$3" flexWrap="wrap">
          <Button
            onPress={() => actions.confirmSecurity(true)}
            color="$colorWhite"
            backgroundColor="$red10"
            hoverStyle={{ backgroundColor: "$red11" }}
            pressedStyle={{ backgroundColor: "$red12" }}
          >
            I Understand, Proceed
          </Button>
          <Button onPress={() => actions.confirmSecurity(false)}>
            Cancel
          </Button>
        </XStack>
      </YStack>
    )
  }

  return (
    <YStack
      padding="$4"
      backgroundColor="white"
      borderRadius="$4"
      borderWidth={1}
      borderColor="#E2E8F0"
      width="100%"
      gap="$4"
      shadow="$1"
    >
      <Text
        fontSize={18}
        fontWeight="bold"
        color="$text"
        textAlign="center"
      >
        Wallet Link (Citizen SDK)
      </Text>

      <YStack gap="$3">
        <Input
          placeholder="0xSecondaryWalletAddress..."
          value={targetAddress}
          onChangeText={handleAddressChange}
          autoCapitalize="none"
          autoCorrect={false}
          borderColor={addressError ? "$red10" : "#E2E8F0"}
        />
        {addressError && (
          <Text color="$red10" fontSize={14}>
            {addressError}
          </Text>
        )}
        <XStack gap="$3" flexWrap="wrap" justifyContent="center">
          <Button
            onPress={handleConnect}
            disabled={actions.loading || !parsedAddress}
            color="$colorWhite"
            backgroundColor={isConnecting ? "$colorGray500" : "$colorGreen500"}
            hoverStyle={{
              backgroundColor: isConnecting ? "$colorGray600" : "$colorGreen600",
            }}
            pressedStyle={{
              backgroundColor: isConnecting ? "$colorGray700" : "$colorGreen700",
            }}
            opacity={actions.loading || !parsedAddress ? 0.7 : 1}
          >
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </Button>
          <Button
            onPress={handleDisconnect}
            disabled={actions.loading || !parsedAddress}
            color="$colorWhite"
            backgroundColor={isDisconnecting ? "$colorGray500" : "$colorBlue500"}
            hoverStyle={{
              backgroundColor: isDisconnecting ? "$colorGray600" : "$colorBlue600",
            }}
            pressedStyle={{
              backgroundColor: isDisconnecting ? "$colorGray700" : "$colorBlue700",
            }}
            opacity={actions.loading || !parsedAddress ? 0.7 : 1}
          >
            {isDisconnecting ? "Disconnecting..." : "Disconnect Wallet"}
          </Button>
          <Button
            onPress={handleCheckStatus}
            disabled={!parsedAddress}
            opacity={!parsedAddress ? 0.7 : 1}
          >
            Check Status
          </Button>
        </XStack>
      </YStack>

      {(actions.error || connectedStatus.error) && (
        <Text color="$red10" fontSize={14} textAlign="center">
          Error:{" "}
          {actions.error || connectedStatus.error}
        </Text>
      )}

      {actions.txHash && (
        <Text color="$green10" fontSize={14} textAlign="center">
          Tx Hash: {actions.txHash}
        </Text>
      )}

      <YStack
        backgroundColor="#F7FAFC"
        borderRadius="$4"
        borderWidth={1}
        borderColor="#E2E8F0"
        padding="$3"
        gap="$2"
      >
        <Text fontSize={14} fontWeight="bold" color="$text">
          Status for {targetAddress || "..."}
        </Text>
        {connectedStatus.loading ? (
          <Text fontSize={14} color="$gray10">
            Loading status...
          </Text>
        ) : (
          <>
            <Text fontSize={14} color="$gray10">
              <Text fontWeight="bold">Connected (Current Chain):</Text>{" "}
              {currentChainStatus?.isConnected ? "Yes" : "No"}
            </Text>
            <Text fontSize={14} color="$gray10">
              <Text fontWeight="bold">Root Identity:</Text>{" "}
              {currentChainStatus?.root || "None"}
            </Text>

            <YStack marginTop="$2" gap="$2">
              <Text fontSize={14} fontWeight="bold" color="$text">
                Multi-Chain Statuses
              </Text>
              {connectedStatus.statuses.map((chain) => (
                <YStack
                  key={chain.chainId}
                  padding="$2"
                  borderRadius="$3"
                  backgroundColor="white"
                  borderWidth={1}
                  borderColor="#E2E8F0"
                  gap="$1"
                >
                  <Text fontSize={14} color="$text" fontWeight="bold">
                    {chain.chainName}
                  </Text>
                  <Text
                    fontSize={13}
                    color={chain.isConnected ? "$green10" : "$gray10"}
                  >
                    {chain.isConnected
                      ? `Connected (Root: ${chain.root})`
                      : "Not connected"}
                  </Text>
                  {chain.error ? (
                    <Text fontSize={13} color="$red10">
                      {chain.error}
                    </Text>
                  ) : null}
                </YStack>
              ))}
            </YStack>
          </>
        )}
      </YStack>
    </YStack>
  )
}
